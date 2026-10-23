import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cacheVersion,
  fileOf,
  injectPrecache,
  manifest,
  PRECACHE_MARK,
  pageAddress,
  precacheList,
  shortcutUrl,
  VERSION_MARK,
} from '../build/pwa.ts';
import { headersFile } from '../build/security.ts';
import { PAGES, PLAY_PATH, SCREEN_SIZES, SCREENSHOTS, SHORTCUT_SIZES, SHORTCUTS } from '../build/site.ts';
import { SHORTCUT_KEYS } from '../src/pwa.ts';

// The installable, offline game (ADR-0015, ADR-0020): what the build writes (the precache list, the version, the
// manifest, the hosts' headers) and what the service worker does with it, against fake caches.

const pub = (f: string) => resolve(import.meta.dirname, '../public', f);

/** Width and height from a PNG's IHDR chunk. */
function png(file: string) {
  const b = readFileSync(file);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

const BUILD = [
  'index.html',
  'en/index.html',
  'play/index.html',
  'mentions-legales/index.html',
  'en/legal/index.html',
  'jouer/index.html',
  'assets/play-CTI4rcfz.js',
  'assets/play-PkBAmglx.css',
  'assets/CardView-CvF7jkP3.js',
  'assets/CardView-CvF7jkP3.js.map',
  'assets/figtree-latin-wght-normal-D_ZTVpCC.woff2',
  'assets/figtree-latin-ext-wght-normal-DCwSJGxG.woff2',
  'assets/bricolage-grotesque-vietnamese-opsz-normal-D9N6E8K1.woff2',
  'assets/jetbrains-mono-latin-500-normal-BWZEU5yA.woff2',
  'assets/jetbrains-mono-latin-500-normal-CJOVTJB7.woff',
  'manifest.webmanifest',
  'icon.svg',
  'icon-192.png',
  'apple-touch-icon.png',
  'screen-table-narrow.png',
  'shortcut-solo-96.png',
  '_headers',
  'sw.js',
];

describe('precacheList', () => {
  const list = precacheList(BUILD);

  it('stores every page under its folder, with the scripts, styles, latin fonts, manifest and icon', () => {
    for (const page of PAGES) expect(list).toContain(pageAddress(page.file));
    for (const f of list) expect(f.endsWith('index.html'), f).toBe(false);
    expect(list).toContain('assets/play-CTI4rcfz.js');
    expect(list).toContain('assets/play-PkBAmglx.css');
    expect(list).toContain('assets/figtree-latin-wght-normal-D_ZTVpCC.woff2');
    // French needs œ, which lives in latin-ext.
    expect(list).toContain('assets/figtree-latin-ext-wght-normal-DCwSJGxG.woff2');
    expect(list).toContain('manifest.webmanifest');
    expect(list).toContain('icon.svg');
  });

  it('leaves out what never loads offline: other scripts, .woff, PNGs, screenshots, maps, the worker itself', () => {
    expect(list.some((f) => f.includes('vietnamese'))).toBe(false);
    expect(list.some((f) => f.endsWith('.woff') || f.endsWith('.map') || f.endsWith('.png'))).toBe(false);
    expect(list).not.toContain('sw.js');
    expect(list).not.toContain('_headers');
    expect(list).toEqual([...list].sort());
  });

  it('maps a stored address back to its file', () => {
    expect(pageAddress('play/index.html')).toBe('./play/');
    expect(pageAddress('index.html')).toBe('./');
    expect(fileOf('./play/')).toBe('play/index.html');
    expect(fileOf('./')).toBe('index.html');
    expect(fileOf('assets/play-CTI4rcfz.js')).toBe('assets/play-CTI4rcfz.js');
  });
});

describe('cacheVersion and injectPrecache', () => {
  it('changes with any byte, not with the order given', () => {
    const a = cacheVersion([
      ['./play/', '<html>a</html>'],
      ['assets/x.js', 'x'],
    ]);
    const b = cacheVersion([
      ['assets/x.js', 'x'],
      ['./play/', '<html>a</html>'],
    ]);
    const c = cacheVersion([
      ['./play/', '<html>b</html>'],
      ['assets/x.js', 'x'],
    ]);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{12}$/);
  });

  it('writes the list and the version into the worker, and refuses a worker without the marks', () => {
    const code = `const P = ${PRECACHE_MARK}; const V = ${VERSION_MARK};`;
    expect(injectPrecache(code, ['./play/', 'icon.svg'], 'abc')).toBe(
      'const P = ["./play/","icon.svg"]; const V = "abc";',
    );
    expect(() => injectPrecache('nothing here', [], 'abc')).toThrow(/needs both/);
  });
});

describe('manifest', () => {
  const m = manifest() as {
    id: string;
    start_url: string;
    scope: string;
    display: string;
    icons: { src: string }[];
    screenshots: { src: string; sizes: string; form_factor: string; label: string }[];
    shortcuts: { name: string; url: string; icons: { src: string; sizes: string }[] }[];
  };

  it('opens the game in its own window, under the id it always had', () => {
    expect(m.start_url).toBe(`./${PLAY_PATH}`);
    expect(m.id).toBe(`./${PLAY_PATH}`);
    expect(m.scope).toBe('./');
    expect(m.display).toBe('standalone');
    // Relative to the manifest, so the same build installs from /tamalou/ too.
    for (const src of [...m.icons, ...m.screenshots, ...m.shortcuts.flatMap((s) => s.icons)].map((i) => i.src)) {
      expect(src.startsWith('/') || src.startsWith('http'), src).toBe(false);
    }
  });

  it('shows screenshots that exist, at the size they claim, within what the install dialog accepts', () => {
    expect(m.screenshots.map((s) => s.form_factor)).toEqual(expect.arrayContaining(['narrow', 'wide']));
    for (const shot of SCREENSHOTS) {
      const entry = m.screenshots.find((s) => s.src === shot.file);
      const size = SCREEN_SIZES[shot.form];
      const [w, h] = [size.width * size.scale, size.height * size.scale];
      expect(entry).toMatchObject({ sizes: `${w}x${h}`, form_factor: shot.form, label: shot.label });
      expect(existsSync(pub(shot.file)), shot.file).toBe(true);
      expect(png(pub(shot.file)), shot.file).toEqual({ width: w, height: h });
      expect(Math.min(w, h)).toBeGreaterThanOrEqual(320);
      expect(Math.max(w, h)).toBeLessThanOrEqual(3840);
      expect(Math.max(w, h) / Math.min(w, h)).toBeLessThanOrEqual(2.3);
    }
    // One size per form factor: the browser wants them alike.
    for (const form of ['narrow', 'wide']) {
      expect(new Set(m.screenshots.filter((s) => s.form_factor === form).map((s) => s.sizes)).size).toBe(1);
    }
  });

  it('offers shortcuts the game answers, with icons that exist', () => {
    expect(SHORTCUTS.map((s) => s.key).sort()).toEqual([...SHORTCUT_KEYS].sort());
    for (const s of SHORTCUTS) {
      const entry = m.shortcuts.find((x) => x.name === s.name);
      expect(entry?.url).toBe(shortcutUrl(s.key));
      expect(entry?.url).toBe(`./${PLAY_PATH}?shortcut=${s.key}`);
      for (const size of SHORTCUT_SIZES) {
        const file = `${s.icon}-${size}.png`;
        expect(entry?.icons).toContainEqual(expect.objectContaining({ src: file, sizes: `${size}x${size}` }));
        expect(png(pub(file)), file).toEqual({ width: size, height: size });
      }
    }
  });
});

describe('_headers', () => {
  it('has the worker checked on every load and the hashed files kept for a year', () => {
    const h = headersFile();
    expect(h).toMatch(/\/sw\.js\n {2}Cache-Control: no-cache/);
    expect(h).toMatch(/\/manifest\.webmanifest\n {2}Content-Type: application\/manifest\+json/);
    expect(h).toMatch(/\/assets\/\*\n {2}Cache-Control: public, max-age=31536000, immutable/);
  });
});

// ---------------------------------------------------------------------------------------------- the worker itself

const SCOPE = 'https://tamalou.example.com/';

class FakeCache {
  readonly entries = new Map<string, string>();
  /** By URL; `ignoreSearch` as the worker asks it (a `?v=` on a stored file still hits). */
  async match(
    req: Request | { url: string } | string,
    opts?: { ignoreSearch?: boolean },
  ): Promise<Response | undefined> {
    const url = typeof req === 'string' ? req : req.url;
    const body = this.entries.get(opts?.ignoreSearch ? url.replace(/\?.*$/, '') : url);
    return body === undefined ? undefined : new Response(body);
  }
  async put(req: Request | { url: string } | string, res: Response): Promise<void> {
    this.entries.set(typeof req === 'string' ? req : req.url, await res.text());
  }
  async addAll(reqs: Request[]): Promise<void> {
    for (const req of reqs) await this.put(req, await fetch(req));
  }
}

interface FakeRequest {
  url: string;
  method: string;
  mode: string;
}

/** Loads the worker as a version holding `files`, with the caches already there. */
async function load(version: string, files: string[], stored: Map<string, FakeCache>) {
  vi.resetModules();
  const listeners: Record<string, (e: unknown) => void> = {};
  const skipWaiting = vi.fn();
  const claim = vi.fn(async () => {});
  vi.stubGlobal('__PRECACHE__', files);
  vi.stubGlobal('__VERSION__', version);
  vi.stubGlobal('self', {
    registration: { scope: SCOPE },
    clients: { claim },
    skipWaiting,
    addEventListener: (type: string, fn: (e: unknown) => void) => {
      listeners[type] = fn;
    },
  });
  vi.stubGlobal('caches', {
    keys: async () => [...stored.keys()],
    has: async (name: string) => stored.has(name),
    delete: async (name: string) => stored.delete(name),
    open: async (name: string) => {
      const cache = stored.get(name) ?? new FakeCache();
      stored.set(name, cache);
      return cache;
    },
  });
  const path = '../src/sw/sw.ts';
  await import(/* @vite-ignore */ path);
  const run = (type: string) => async () => {
    let done: Promise<unknown> = Promise.resolve();
    listeners[type]?.({ waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
  };
  /** What the worker answers a request with: a response, or `undefined` when it leaves it to the browser. */
  const fetchEvent = async (path: string, mode = 'no-cors', method = 'GET') => {
    let answer: Promise<Response> | undefined;
    const waited: Promise<unknown>[] = [];
    const request: FakeRequest = { url: path.startsWith('http') ? path : SCOPE + path, method, mode };
    listeners.fetch?.({
      request,
      respondWith: (p: Promise<Response>) => {
        answer = p;
      },
      waitUntil: (p: Promise<unknown>) => waited.push(p),
    });
    const res = await answer;
    await Promise.all(waited);
    return res;
  };
  const message = (data: unknown) => listeners.message?.({ data });
  return { install: run('install'), activate: run('activate'), fetchEvent, message, skipWaiting, claim };
}

const PAGES_STORED = PAGES.map((p) => pageAddress(p.file));
const FIRST = [...PAGES_STORED, 'assets/play-1.js', 'assets/font-a.woff2', 'icon.svg', 'manifest.webmanifest'];

/** Every fetch answers with a body naming its path. */
function fakeNetwork(): string[] {
  const fetched: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (req: Request | FakeRequest) => {
      fetched.push(new URL(req.url).pathname);
      return new Response(`body of ${new URL(req.url).pathname}`);
    }),
  );
  return fetched;
}

afterEach(() => vi.unstubAllGlobals());

describe('service worker install and activate', () => {
  it('downloads what changed and copies the hashed files the previous version holds', async () => {
    const fetched = fakeNetwork();
    const stored = new Map<string, FakeCache>();
    await (await load('one', FIRST, stored)).install();
    expect(fetched).toHaveLength(FIRST.length);
    expect(fetched).toContain('/play/');
    expect(fetched).toContain('/assets/font-a.woff2');

    fetched.length = 0;
    const second = [...PAGES_STORED, 'assets/play-2.js', 'assets/font-a.woff2', 'icon.svg', 'manifest.webmanifest'];
    await (await load('two', second, stored)).install();
    // The font kept its hashed name: copied. The pages, the icon, the manifest and the new bundle: downloaded.
    expect(fetched).not.toContain('/assets/font-a.woff2');
    expect(fetched).toContain('/assets/play-2.js');
    expect(fetched).toContain('/play/');
    expect(stored.get('tamalou-two')?.entries.get(`${SCOPE}assets/font-a.woff2`)).toBe('body of /assets/font-a.woff2');
  });

  it('never takes over on its own: a message does, and activating drops the older caches', async () => {
    fakeNetwork();
    const stored = new Map<string, FakeCache>([
      ['tamalou-old', new FakeCache()],
      ['other-thing', new FakeCache()],
    ]);
    const sw = await load('new', FIRST, stored);
    await sw.install();
    expect(sw.skipWaiting).not.toHaveBeenCalled();
    sw.message('skip-waiting');
    expect(sw.skipWaiting).toHaveBeenCalledOnce();
    await sw.activate();
    expect([...stored.keys()].sort()).toEqual(['other-thing', 'tamalou-new']);
    expect(sw.claim).toHaveBeenCalledOnce();
  });

  it('fails an install whose cache an older version deleted meanwhile, and stores its files again on activation', async () => {
    fakeNetwork();
    const stored = new Map<string, FakeCache>();
    stored.set('tamalou-gone', new FakeCache());
    const sw = await load('gone', FIRST, stored);
    // Simulate the older version's activation: every other cache goes, this one included, during the install.
    const cachesDelete = async (name: string) => stored.delete(name);
    vi.stubGlobal('caches', {
      keys: async () => [...stored.keys()],
      has: async (name: string) => stored.has(name) && name !== 'tamalou-gone',
      delete: cachesDelete,
      open: async (name: string) => {
        const cache = stored.get(name) ?? new FakeCache();
        stored.set(name, cache);
        return cache;
      },
    });
    await expect(sw.install()).rejects.toThrow(/deleted/);
    vi.stubGlobal('caches', {
      keys: async () => [...stored.keys()],
      has: async (name: string) => stored.has(name),
      delete: cachesDelete,
      open: async (name: string) => {
        const cache = stored.get(name) ?? new FakeCache();
        stored.set(name, cache);
        return cache;
      },
    });
    stored.delete('tamalou-gone');
    await sw.activate();
    expect(stored.get('tamalou-gone')?.entries.has(`${SCOPE}play/`)).toBe(true);
  });
});

describe('service worker fetch', () => {
  async function ready() {
    const fetched = fakeNetwork();
    const stored = new Map<string, FakeCache>();
    const sw = await load('v', FIRST, stored);
    await sw.install();
    fetched.length = 0;
    return { sw, fetched, stored };
  }

  it('opens the game from the cache, whatever its address, and the home pages from the network first', async () => {
    const { sw, fetched } = await ready();
    for (const path of ['play/', 'play', 'play/index.html', 'play/?shortcut=solo']) {
      expect(await (await sw.fetchEvent(path, 'navigate'))?.text(), path).toBe('body of /play/');
    }
    expect(fetched).toEqual([]);
    expect(await (await sw.fetchEvent('en/', 'navigate'))?.text()).toBe('body of /en/');
    expect(fetched).toEqual(['/en/']);
  });

  it('gives the stored page when the network fails, for every page of the site', async () => {
    const { sw } = await ready();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('offline'))),
    );
    for (const path of ['', 'index.html', 'en', 'en/', 'en/legal/', 'mentions-legales/', 'jouer/']) {
      const res = await sw.fetchEvent(path, 'navigate');
      expect(res?.ok, path).toBe(true);
    }
    // Not a page of the site: left to the browser.
    expect(await sw.fetchEvent('robots.txt', 'navigate')).toBeUndefined();
    expect(await sw.fetchEvent('nowhere/', 'navigate')).toBeUndefined();
    expect(await sw.fetchEvent('play/nowhere/', 'navigate')).toBeUndefined();
  });

  it('leaves the rooms API, other origins, other methods and unknown files to the network', async () => {
    const { sw, fetched } = await ready();
    expect(await sw.fetchEvent('api/health')).toBeUndefined();
    expect(await sw.fetchEvent('api/rooms/ABCDE/ws')).toBeUndefined();
    expect(await sw.fetchEvent('https://insight.steevepommier.com/insight')).toBeUndefined();
    expect(await sw.fetchEvent('assets/play-1.js', 'no-cors', 'POST')).toBeUndefined();
    expect(await sw.fetchEvent('icon-192.png')).toBeUndefined();
    expect(fetched).toEqual([]);
  });

  it('serves stored files from the cache and keeps a hashed file fetched later', async () => {
    const { sw, fetched, stored } = await ready();
    expect(await (await sw.fetchEvent('assets/play-1.js'))?.text()).toBe('body of /assets/play-1.js');
    expect(await (await sw.fetchEvent('icon.svg?v=2'))?.text()).toBe('body of /icon.svg');
    expect(fetched).toEqual([]);
    expect(await (await sw.fetchEvent('assets/later.woff2'))?.text()).toBe('body of /assets/later.woff2');
    expect(fetched).toEqual(['/assets/later.woff2']);
    expect(stored.get('tamalou-v')?.entries.has(`${SCOPE}assets/later.woff2`)).toBe(true);
  });
});
