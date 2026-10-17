import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { rulesFromPreset } from '@tamalou/shared';
import { describe, expect, it } from 'vitest';
import { inputs, link, pageBody, pageHead } from '../build/pages.ts';
import { serviceWorkerSource } from '../build/pwa.ts';
import { CONTACT, PAGES, PLAY_PATH, pageOf, SITE_URL, siteUrl, toRoot } from '../build/site.ts';
import { DURATIONS } from '../src/landing/live.tsx';
import { LANDING } from '../src/landing/text.ts';
import { LEGAL } from '../src/legal/text.ts';

// The site's pages (ADR-0016): every page has its shell, the home pages carry their words in the static HTML, links
// stay relative (the same build serves a domain's root and GitHub Pages' /tamalou/), and what the home page says about
// the presets is what the presets do.

const root = resolve(import.meta.dirname, '..');
const home = PAGES.find((p) => p.file === 'index.html');
const homeEn = PAGES.find((p) => p.file === 'en/index.html');
const play = PAGES.find((p) => p.kind === 'play');

describe('pages', () => {
  it('has a shell with both placeholders for every page, and an input for Vite', () => {
    for (const page of PAGES) {
      const shell = readFileSync(resolve(root, page.file), 'utf8');
      expect(shell, page.file).toContain('<!-- page:head -->');
      if (page.kind !== 'play') expect(shell, page.file).toContain('<!-- page:body -->');
      expect(shell, page.file).toContain(`lang="${page.lang}"`);
      expect(pageOf(page.file)).toBe(page);
    }
    expect(Object.values(inputs(root)).every((f) => existsSync(f))).toBe(true);
  });

  it('links relatively from any folder', () => {
    if (!home || !homeEn || !play) throw new Error('pages missing');
    expect(toRoot(home)).toBe('');
    expect(toRoot(homeEn)).toBe('../');
    expect(link(home, '')).toBe('./');
    expect(link(home, PLAY_PATH)).toBe('jouer/');
    expect(link(homeEn, PLAY_PATH)).toBe('../jouer/');
    expect(link(homeEn, '')).toBe('../');
  });

  it('writes every word of the home page into its HTML', () => {
    for (const page of [home, homeEn]) {
      if (!page) throw new Error('page missing');
      const t = LANDING[page.lang];
      const body = pageBody(page);
      for (const text of [
        t.heroTitle,
        t.heroLead,
        t.rulesTitle,
        t.valuesTitle,
        t.powersTitle,
        t.modesTitle,
        t.finalTitle,
      ])
        expect(body).toContain(text);
      for (const r of t.rules) expect(body).toContain(r.p);
      for (const m of t.modes) expect(body).toContain(m.t);
      expect(body).toContain(`href="${link(page, PLAY_PATH)}"`);
      expect(body).not.toMatch(/href="\/[^/]/);
    }
  });

  it('names the other language and the canonical address in the head', () => {
    if (!home || !play) throw new Error('pages missing');
    const head = pageHead(home, SITE_URL);
    expect(head).toContain(`<link rel="canonical" href="${SITE_URL}" />`);
    expect(head).toContain(`hreflang="en" href="${SITE_URL}en/"`);
    expect(head).toContain(`hreflang="x-default" href="${SITE_URL}"`);
    // Old room and rules links, and an app installed when the game was at the root, land on the game.
    expect(head).toContain('location.replace("jouer/"+h)');
    const game = pageHead(play, SITE_URL);
    expect(game).toContain('noindex');
    expect(game).not.toContain('location.replace');
  });

  it('reads the canonical address from the build', () => {
    expect(siteUrl({})).toBe(SITE_URL);
    expect(siteUrl({ VITE_SITE_URL: 'https://example.org/tamalou' })).toBe('https://example.org/tamalou/');
    expect(siteUrl({ VITE_SITE_URL: 'javascript:alert(1)' })).toBe(SITE_URL);
  });

  it('says what the presets really do', () => {
    for (const lang of ['fr', 'en'] as const) {
      for (const p of LANDING[lang].presets) {
        const rules = rulesFromPreset(p.id);
        expect(p.cells[0]).toBe(String(rules.gameEnd.threshold));
        expect(p.cells[1]).toBe(`+${rules.tamalou.failPenalty.amount}`);
        expect(p.cells[2]).toBe(LANDING[lang].presets[rules.gameEnd.thresholdEnd === 'lastStanding' ? 0 : 1]?.cells[2]);
        expect(p.cells[3]).toBe(LANDING[lang].presets[rules.assist.showKnownCards ? 2 : 0]?.cells[3]);
      }
    }
  });

  it('gives every scene of the live table a caption, in both languages', () => {
    for (const lang of ['fr', 'en'] as const) {
      expect(LANDING[lang].liveCaptions).toHaveLength(DURATIONS.length);
      expect(LANDING[lang].liveSteps).toHaveLength(7);
    }
  });

  it('serves a cached page for any folder offline, and the game for anything else', () => {
    const src = serviceWorkerSource(['index.html', 'jouer/index.html'], 'v1');
    expect(src).toContain("rel + 'index.html'");
    expect(src).toContain('"jouer/index.html"');
  });

  it('writes the legal notice in both languages, linked from every static page', () => {
    for (const page of PAGES.filter((p) => p.kind === 'legal')) {
      const t = LEGAL[page.lang];
      const body = pageBody(page);
      for (const title of [
        t.pubTitle,
        t.hostTitle,
        t.privTitle,
        t.roomsTitle,
        t.countTitle,
        t.rightsTitle,
        t.liabTitle,
      ])
        expect(body).toContain(title);
      expect(body).toContain(`mailto:${CONTACT}`);
      expect(body).not.toMatch(/\{(email|source|license)\}/);
      for (const state of ['on', 'off', 'signal', 'none']) expect(body).toContain(`data-when="${state}"`);
      expect(pageHead(page, SITE_URL)).toContain(`<link rel="canonical" href="${SITE_URL}${page.path}" />`);
    }
    for (const page of PAGES.filter((p) => p.kind !== 'play')) {
      const legal = PAGES.find((p) => p.kind === 'legal' && p.lang === page.lang);
      expect(pageBody(page)).toContain(`href="${link(page, legal?.path ?? '')}">${LANDING[page.lang].footLegal}</a>`);
    }
  });

  it('measures only what the legal notice lists', () => {
    // Every event the code sends. A new one is described in src/legal/text.ts (count2) before it joins this list.
    const sent = new Set<string>();
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const f = resolve(dir, e.name);
        if (e.isDirectory()) walk(f);
        else for (const m of readFileSync(f, 'utf8').matchAll(/trackEvent\('([\w-]+)'/g)) sent.add(m[1] ?? '');
      }
    };
    walk(resolve(root, 'src'));
    expect([...sent].sort()).toEqual(['app-installed', 'game-over', 'game-started', 'room-created', 'rules-shared']);
    expect(LEGAL.fr.count2).toContain('une installation');
    expect(LEGAL.en.count3).toContain('a room’s code');
  });
});
