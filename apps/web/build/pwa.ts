import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import { APP, PAGES, PLAY_PATH, SCREEN_SIZES, SCREENSHOTS, SHORTCUT_SIZES, SHORTCUTS, THEME } from './site.ts';

/**
 * The installable, offline game (ADR-0015, ADR-0020): the web app manifest, the service worker and the hosts' headers
 * are written at build time from build/site.ts, as Versus does.
 *
 * - The manifest (`manifest.webmanifest`) opens the game (`start_url: ./play/`) in a window of its own, with the
 *   install dialog's screenshots and the icon's shortcuts.
 * - The service worker (src/sw/sw.ts) is bundled as `sw.js` at the site's root, its scope the whole site; once the
 *   build is on disk, the list of files to store at install and a version made from their bytes are written into it,
 *   so every deploy that changes the game installs a new worker. Solo and pass-and-play then work without a network;
 *   rooms never go through it (`api/` is left to the network).
 * - `_headers` tells Cloudflare (apps/worker serves this folder) to check the worker on every load and to keep the
 *   hashed files for a year; GitHub Pages and the LAN server ignore the file.
 */

export const SW_FILE = 'sw.js';
const SW_SOURCE = 'src/sw/sw.ts';
export const MANIFEST_FILE = 'manifest.webmanifest';
export const HEADERS_FILE = '_headers';

/** Placeholders in src/sw/sw.ts, replaced in the built worker. */
export const PRECACHE_MARK = '__PRECACHE__';
export const VERSION_MARK = '__VERSION__';

/**
 * What the worker stores at install: every page of build/site.ts (the game, the home pages, the legal notices, the
 * old address that forwards), the scripts and styles, the latin fonts (French needs latin-ext for œ and Œ; the
 * Vietnamese subset and the .woff fallback never load), the manifest and the SVG icon. The PNG icons, the
 * screenshots and `_headers` are never needed offline.
 */
const PRECACHE = [
  /^assets\/[^/]+\.(?:js|css)$/,
  /^assets\/[^/]+-latin(?:-ext)?-[^/]*\.woff2$/,
  new RegExp(`^${MANIFEST_FILE.replace(/\./g, '\\.')}$`),
  /^icon\.svg$/,
];

/** A page's address from its file: `play/index.html` is stored as `./play/`, `index.html` as `./`. */
export const pageAddress = (file: string): string => `./${file.replace(/index\.html$/, '')}`;

/** The file behind a stored address: `./play/` → `play/index.html`. Other entries are their own file. */
export const fileOf = (entry: string): string =>
  entry.endsWith('/') ? `${entry.replace(/^\.\//, '')}index.html` : entry;

/**
 * The files to store, relative to the worker's scope, sorted. Pages are stored under their folder's address, the one
 * every host serves directly: Cloudflare answers `/play/index.html` with a redirect to `/play/`, and a navigation
 * can never be answered with a redirected response.
 */
export function precacheList(files: Iterable<string>): string[] {
  const pages = new Set(PAGES.map((p) => p.file));
  return [...files]
    .filter((f) => pages.has(f) || PRECACHE.some((re) => re.test(f)))
    .map((f) => (pages.has(f) ? pageAddress(f) : f))
    .sort();
}

/** A short hash of the stored files' names and bytes: it changes, and a new worker installs, on every deploy that changes them. */
export function cacheVersion(files: ReadonlyArray<readonly [name: string, body: string | Uint8Array]>): string {
  const hash = createHash('sha256');
  for (const [name, body] of [...files].sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0))) {
    hash.update(name).update('\0').update(body).update('\0');
  }
  return hash.digest('hex').slice(0, 12);
}

/** Puts the precache list and the version into the built worker. */
export function injectPrecache(code: string, list: readonly string[], version: string): string {
  if (!code.includes(PRECACHE_MARK) || !code.includes(VERSION_MARK)) {
    throw new Error(`the service worker needs both ${PRECACHE_MARK} and ${VERSION_MARK}`);
  }
  return code.replaceAll(PRECACHE_MARK, JSON.stringify(list)).replaceAll(VERSION_MARK, JSON.stringify(version));
}

/** The address a shortcut opens: the game, with the key the app reads once (src/pwa.ts). */
export const shortcutUrl = (key: string): string => `./${PLAY_PATH}?shortcut=${key}`;

/**
 * The web app manifest. Every address is relative to the manifest, at the site's root, so the same build installs
 * from a domain's root and from GitHub Pages' /tamalou/. `id` is spelled out as what it already was by default (the
 * start address), so a change of start address later never splits installed copies into another app. Colours are
 * the light palette: a manifest is read once at install and cannot follow the theme.
 */
export function manifest(): Record<string, unknown> {
  return {
    id: `./${PLAY_PATH}`,
    name: APP.name,
    short_name: APP.name,
    description: APP.description,
    lang: APP.lang,
    dir: 'ltr',
    start_url: `./${PLAY_PATH}`,
    scope: './',
    display: 'standalone',
    orientation: 'portrait',
    background_color: THEME.bg.light,
    theme_color: THEME.accent,
    categories: ['games', 'entertainment'],
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    screenshots: SCREENSHOTS.map((s) => {
      const size = SCREEN_SIZES[s.form];
      return {
        src: s.file,
        sizes: `${size.width * size.scale}x${size.height * size.scale}`,
        type: 'image/png',
        form_factor: s.form,
        label: s.label,
      };
    }),
    shortcuts: SHORTCUTS.map((s) => ({
      name: s.name,
      short_name: s.short,
      description: s.description,
      url: shortcutUrl(s.key),
      icons: SHORTCUT_SIZES.map((size) => ({
        src: `${s.icon}-${size}.png`,
        sizes: `${size}x${size}`,
        type: 'image/png',
      })),
    })),
  };
}

/** Cloudflare's `_headers`: the worker and the manifest checked on every load, the hashed files kept for a year. */
export function headersFile(): string {
  return [
    `/${SW_FILE}`,
    '  Cache-Control: no-cache',
    '',
    `/${MANIFEST_FILE}`,
    '  Content-Type: application/manifest+json; charset=utf-8',
    '  Cache-Control: no-cache',
    '',
    '/assets/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
  ].join('\n');
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

export function pwa(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'tamalou-pwa',
    apply: 'build',
    configResolved(resolved) {
      config = resolved;
    },
    buildStart() {
      // The worker is bundled like the app (TypeScript, minified), under a fixed name at the root.
      this.emitFile({ type: 'chunk', id: resolve(config.root, SW_SOURCE), fileName: SW_FILE });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: MANIFEST_FILE, source: `${JSON.stringify(manifest(), null, 2)}\n` });
      this.emitFile({ type: 'asset', fileName: HEADERS_FILE, source: headersFile() });
    },
    closeBundle() {
      // Read back from disk once everything is written (the pages after their own transforms, public/ copied): the
      // list and the version then describe exactly what a visitor downloads.
      const outDir = join(config.root, config.build.outDir);
      const files = walk(outDir).map((f) => relative(outDir, f).split(sep).join('/'));
      const list = precacheList(files);
      const version = cacheVersion(list.map((f) => [f, readFileSync(join(outDir, fileOf(f)))] as const));
      const sw = join(outDir, SW_FILE);
      writeFileSync(sw, injectPrecache(readFileSync(sw, 'utf8'), list, version));
    },
  };
}
