import { describe, expect, it } from 'vitest';
import { pageHead } from '../build/pages.ts';
import { precacheList } from '../build/pwa.ts';
import { GENERATED, generatedFiles, indexedPages, lastmod, llmsTxt, robotsTxt, sitemapXml } from '../build/seo.ts';
import { PAGES, PLAY_PATH, SITE_URL, SOURCE_URL, toRoot } from '../build/site.ts';

// Findability (COMMON-PROJECT-SPEC C17): what a crawler or an answer engine reads, written at build time from
// build/site.ts and held here to the pages' own heads.

describe('findability', () => {
  it('lets every crawler in, keeps the rooms API out, and names the sitemap', () => {
    const robots = robotsTxt(SITE_URL);
    expect(robots).toContain('User-agent: *\nAllow: /\nDisallow: /api/');
    expect(robots).toContain(`Sitemap: ${SITE_URL}sitemap.xml`);
  });

  it('lists in the sitemap exactly the pages with a canonical address, never one that says noindex', () => {
    const xml = sitemapXml(SITE_URL, '2026-10-19');
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual(indexedPages().map((p) => `${SITE_URL}${p.path}`));
    expect(locs).toHaveLength(4);
    for (const page of PAGES) {
      const listed = locs.includes(`${SITE_URL}${page.path}`);
      expect(listed, page.file).toBe(!pageHead(page, SITE_URL).includes('noindex'));
    }
    expect(xml).toContain('<lastmod>2026-10-19</lastmod>');
  });

  it('writes llms.txt with the game and every address worth reading', () => {
    const txt = llmsTxt(SITE_URL);
    expect(txt.startsWith('# Tamalou\n')).toBe(true);
    for (const url of [
      SITE_URL,
      `${SITE_URL}en/`,
      `${SITE_URL}${PLAY_PATH}`,
      `${SITE_URL}mentions-legales/`,
      `${SITE_URL}en/legal/`,
      SOURCE_URL,
    ])
      expect(txt).toContain(`](${url})`);
  });

  it('points at the sitemap and llms.txt from the indexed pages, relatively', () => {
    for (const page of PAGES) {
      const head = pageHead(page, SITE_URL);
      const indexed = indexedPages().includes(page);
      expect(head.includes(`href="${toRoot(page)}sitemap.xml"`), page.file).toBe(indexed);
      expect(head.includes(`href="${toRoot(page)}llms.txt"`), page.file).toBe(indexed);
    }
  });

  it('writes the three files at the root with their types, and keeps them out of the offline cache', () => {
    const files = generatedFiles(SITE_URL, '2026-10-19');
    expect(Object.keys(files)).toEqual([...GENERATED]);
    expect(files['robots.txt']?.type).toBe('text/plain; charset=utf-8');
    expect(files['sitemap.xml']?.type).toBe('application/xml; charset=utf-8');
    expect(files['llms.txt']?.type).toBe('text/markdown; charset=utf-8');
    expect(precacheList(['robots.txt', 'index.html', 'sitemap.xml', 'llms.txt'])).toEqual(['index.html']);
    expect(lastmod()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
