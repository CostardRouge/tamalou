import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pageHead } from '../build/pages.ts';
import { precacheList } from '../build/pwa.ts';
import { COLORS, OG_IMAGES, PAGES, SITE_URL, toRoot } from '../build/site.ts';

// COMMON-PROJECT-SPEC C11, whose failure is silent (every desktop tab looks right while an iPhone shows a screenshot):
// the touch icon exists, is 180×180 and has no alpha channel; every icon the page and the manifest name exists; the
// manifest's paths are relative, so the same build works under GitHub Pages' /tamalou/.

const root = resolve(import.meta.dirname, '..');
const pub = (f: string) => resolve(root, 'public', f);

/** Width, height and colour type from a PNG's IHDR chunk (colour type 2 = RGB, 6 = RGBA). */
function png(file: string) {
  const b = readFileSync(file);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), colorType: b[25] };
}

describe('icon set', () => {
  it('ships an opaque 180×180 apple-touch-icon', () => {
    expect(png(pub('apple-touch-icon.png'))).toEqual({ width: 180, height: 180, colorType: 2 });
  });

  it('declares only files that exist, at the size they claim', () => {
    for (const page of PAGES) {
      const head = pageHead(page, SITE_URL);
      const links = [...head.matchAll(/<link rel="(?:icon|apple-touch-icon|manifest)" href="([^"]+)"/g)];
      expect(links.length, page.file).toBe(5);
      for (const [, href] of links) {
        // Relative to the page, so a page in a folder climbs back to the root.
        expect(href?.startsWith(toRoot(page)), href).toBe(true);
        expect(existsSync(pub((href as string).slice(toRoot(page).length))), href).toBe(true);
      }
    }
    const manifest = JSON.parse(readFileSync(pub('manifest.webmanifest'), 'utf8'));
    // An installed game opens on the game, not on the home page (ADR-0017).
    expect(manifest.start_url).toBe('./play/');
    for (const icon of manifest.icons) {
      expect(icon.src.startsWith('/')).toBe(false);
      const [w, h] = icon.sizes.split('x').map(Number);
      expect(png(pub(icon.src)), icon.src).toMatchObject({ width: w, height: h });
    }
  });

  // COMMON-PROJECT-SPEC C17: a shared link unfurls a 1200×630 card in the page's language, never the icon.
  it('ships a social card per language, named with its size by every page that can be shared', () => {
    for (const lang of ['fr', 'en'] as const) {
      const card = OG_IMAGES[lang];
      expect(card).toMatchObject({ width: 1200, height: 630 });
      expect(png(pub(card.path)), card.path).toMatchObject({ width: card.width, height: card.height });
    }
    for (const page of PAGES) {
      const head = pageHead(page, SITE_URL);
      const card = OG_IMAGES[page.lang];
      if (page.kind === 'play' || page.kind === 'moved') {
        expect(head, page.file).not.toContain('og:image');
      } else {
        expect(head, page.file).toContain(`<meta property="og:image" content="${SITE_URL}${card.path}" />`);
        expect(head, page.file).toContain(`<meta property="og:image:width" content="${card.width}" />`);
        expect(head, page.file).toContain(`<meta property="og:image:alt" content="${card.alt}" />`);
        expect(head, page.file).toContain('<meta name="twitter:card" content="summary_large_image" />');
        expect(head, page.file).not.toContain('icon-512.png');
      }
    }
    // A phone playing offline never needs a link preview: the service worker leaves the cards out.
    expect(precacheList(['og.png', 'index.html', 'og-en.png', 'icon-192.png'])).toEqual(['index.html', 'icon-192.png']);
  });

  it('draws outside CSS with the stylesheet’s own light tokens', () => {
    const css = readFileSync(resolve(root, 'src/styles/tokens.css'), 'utf8');
    const block = (selector: string) => css.slice(css.indexOf(selector)).split('}')[0] ?? '';
    const token = (b: string, name: string) => b.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`))?.[1];
    const light = block(':root {');
    const dark = block(':root[data-theme="dark"]');
    expect(COLORS).toEqual({
      bg: token(light, 'bg'),
      bgDark: token(dark, 'bg'),
      ink: token(light, 'ink'),
      muted: token(light, 'muted'),
      a: token(light, 'a'),
      b: token(light, 'b'),
      cardFace: token(light, 'card-face'),
      cardEdge: token(light, 'card-edge'),
      cardBackInk: token(light, 'card-back-ink'),
    });
  });
});
