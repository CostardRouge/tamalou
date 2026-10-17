import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pageHead } from '../build/pages.ts';
import { PAGES, SITE_URL, toRoot } from '../build/site.ts';

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
    expect(manifest.start_url).toBe('./jouer/');
    for (const icon of manifest.icons) {
      expect(icon.src.startsWith('/')).toBe(false);
      const [w, h] = icon.sizes.split('x').map(Number);
      expect(png(pub(icon.src)), icon.src).toMatchObject({ width: w, height: h });
    }
  });
});
