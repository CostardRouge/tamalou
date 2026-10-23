/**
 * Tamalou's service worker: the game opens at once and works offline (ADR-0015, ADR-0020).
 *
 * The build (build/pwa.ts) replaces the two placeholders below with the files to store at install and a version
 * made from their bytes, so every deploy that changes the game installs a new worker. The new worker then waits
 * until the page asks it to take over (src/pwa.ts), which the player decides from the home screen: a deploy never
 * reloads the page in the middle of a game, and no page ever runs one version's script against another's files.
 *
 * Only the site's own files go through here. The rooms API and its WebSocket (`api/`), other origins (the audience
 * measurement tracker included) and anything but GET reach the network untouched. The game (`play/`) opens from the
 * cache; the other pages (the home pages, the legal notices, the old address) come from the network when it answers
 * in time, so they are always current, and from the cache otherwise.
 */

declare const self: ServiceWorkerGlobalScope;
declare const __PRECACHE__: string[];
declare const __VERSION__: string;

const PREFIX = 'tamalou-';
const CACHE = `${PREFIX}${__VERSION__}`;
const scope = new URL(self.registration.scope);
const at = (path: string): string => new URL(path, scope).href;
const PRECACHED = new Set(__PRECACHE__.map(at));
/** The game's folder and its page, stored under the folder's address (see precacheList in build/pwa.ts). */
const PLAY = 'play/';
const SHELL = at(`./${PLAY}`);
/** The pages stored at install, by address: every precached entry that is a folder. */
const PAGES = new Set([...PRECACHED].filter((url) => url.endsWith('/')));
/** How long a phone on bad Wi-Fi waits for a current page before the stored one shows. */
const SLOW_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(precache());
});

/**
 * Stores the files of this version. Files under assets/ have hashed names: one the previous version already holds
 * is the same file, copied over instead of downloaded again (a deploy changes a few of them, rarely the fonts). The
 * rest is fetched with `reload`, which skips the HTTP cache: it could still hold the previous deploy's page.
 */
async function precache(): Promise<void> {
  const cache = await caches.open(CACHE);
  const previous = await Promise.all(
    (await caches.keys()).filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.open(k)),
  );
  const fetched: Request[] = [];
  for (const url of PRECACHED) {
    const hashed = new URL(url).pathname.startsWith(`${scope.pathname}assets/`);
    let kept: Response | undefined;
    for (const old of hashed ? previous : []) {
      kept = await old.match(url);
      if (kept) break;
    }
    if (kept) await cache.put(url, kept);
    else fetched.push(new Request(url, { cache: 'reload' }));
  }
  await cache.addAll(fetched);
  // An older version that took over meanwhile (Reload in a tab) deleted every other cache, this one included: this
  // install fails, and the browser tries it again at its next update check.
  if (!(await caches.has(CACHE))) throw new Error('cache deleted during install');
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // The files of this version, stored again if an older version's activation deleted them after the install.
      if (!(await caches.has(CACHE))) await precache().catch(() => {});
      for (const key of await caches.keys()) {
        if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') void self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const path = url.pathname.slice(scope.pathname.length);
  if (path.startsWith('api/')) return;
  if (req.mode === 'navigate') {
    // `play` without its slash is the address people type; a room or rules link is the same page with a fragment.
    // Only the folder itself: deeper (`play/x/`), the page's relative links would break; the network's 404 answers.
    if (folderOf(path) === PLAY) event.respondWith(page(req));
    else {
      const stored = at(`./${folderOf(path)}`);
      if (PAGES.has(stored)) event.respondWith(fresh(req, stored));
    }
    return;
  }
  if (PRECACHED.has(url.origin + url.pathname) || path.startsWith('assets/')) event.respondWith(file(req, event));
});

/** The folder a page address names: `en`, `en/` and `en/index.html` are the same page. */
function folderOf(path: string): string {
  const folder = path.replace(/index\.html$/, '');
  return folder === '' || folder.endsWith('/') ? folder : `${folder}/`;
}

/** The game: the stored page, or the network if the cache was cleared. */
async function page(req: Request): Promise<Response> {
  const cache = await caches.open(CACHE);
  return (await cache.match(SHELL)) ?? fetch(req);
}

/** Another page: the network when it answers in time, so it is always current; the stored copy otherwise. */
async function fresh(req: Request, stored: string): Promise<Response> {
  const network = fetch(req);
  // A rejected race must not surface on its own: the network promise is awaited again below.
  network.catch(() => {});
  try {
    return await Promise.race([
      network,
      new Promise<never>((_, ko) => setTimeout(() => ko(new Error('slow')), SLOW_MS)),
    ]);
  } catch {
    const hit = await (await caches.open(CACHE)).match(stored);
    return hit ?? network;
  }
}

/** Stored files first. Files under assets/ have hashed names and never change: keep the ones fetched later. */
async function file(req: Request, event: FetchEvent): Promise<Response> {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) event.waitUntil(cache.put(req, res.clone()));
  return res;
}

export {};
