// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LANG_CODES, LANGUAGES, type Lang, READY_LANGS } from '@tamalou/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { CATALOGS, type Catalog, flatten, readCatalog, status } from '../build/i18n.ts';
import { fr } from '../src/i18n/fr.ts';
import {
  cardName,
  currentLang,
  DICTIONARY_FILES,
  hasDictionary,
  LANGS,
  languageChoices,
  ordinal,
  pickLang,
  plural,
  rankShort,
  setLang,
  sitePaths,
  t,
} from '../src/i18n/index.ts';
import { pseudoMessages, pseudoText } from '../src/i18n/pseudo.ts';
import { LANG_KEY } from '../src/i18n/remember.ts';
import { LANDING } from '../src/landing/text/index.ts';
import { LEGAL } from '../src/legal/text/index.ts';

// The languages (ADR-0028, docs/plans/languages.md § 5): every dictionary in step with French, the forms each language
// needs, the language the game opens in.

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const catalogs = Object.keys(CATALOGS) as Catalog[];

/** Every language's file of every catalog that exists, flattened. */
async function files(): Promise<Array<{ lang: Lang; catalog: Catalog; texts: Record<string, string> }>> {
  const out = [];
  for (const lang of LANG_CODES)
    for (const catalog of catalogs) {
      const texts = await readCatalog(catalog, lang);
      if (texts) out.push({ lang, catalog, texts });
    }
  return out;
}

afterEach(() => {
  localStorage.clear();
  return setLang('fr', false);
});

describe('dictionaries', () => {
  it('give every ready language the game, its home page and its legal notice', () => {
    for (const lang of READY_LANGS) {
      expect(hasDictionary(lang), lang).toBe(true);
      expect(LANDING[lang], lang).toBeTruthy();
      expect(LEGAL[lang], lang).toBeTruthy();
    }
    expect(LANGS).toEqual(READY_LANGS);
  });

  it('have French’s keys and placeholders in every language, in every catalog', async () => {
    for (const { lang, catalog, texts } of await files()) {
      const source = (await readCatalog(catalog, 'fr')) ?? {};
      expect(Object.keys(texts).sort(), `${lang} ${catalog}`).toEqual(Object.keys(source).sort());
      for (const [key, french] of Object.entries(source))
        expect(placeholders(texts[key] ?? ''), `${lang} ${catalog} ${key}`).toEqual(placeholders(french));
    }
  });

  it('are translated from today’s French: nothing stale, unstamped or left in French (pnpm i18n:status)', async () => {
    for (const lang of LANG_CODES) {
      if (lang === 'fr') continue;
      const s = await status(lang);
      for (const catalog of catalogs) {
        const c = s[catalog];
        expect({ lang, catalog, missing: c.missing, stale: c.stale, unstamped: c.unstamped, same: c.same }).toEqual({
          lang,
          catalog,
          missing: [],
          stale: [],
          unstamped: [],
          same: [],
        });
      }
    }
  });

  it('follow each language’s typography', async () => {
    for (const { lang, catalog, texts } of await files()) {
      for (const [key, text] of Object.entries(texts)) {
        const where = `${lang} ${catalog} ${key}`;
        const words = text.replace(/\{\w+\}|<[^>]+>|https?:\S+|&#?\w+;/g, '');
        // Japanese and Chinese punctuate in full width: 、。！？，
        if (lang === 'ja' || lang.startsWith('zh'))
          expect(words, where).not.toMatch(/\p{Script=Han}[,.!?]|[,.!?]\p{Script=Han}/u);
        // German quotes „so“, never «so» nor "so".
        if (lang === 'de') expect(words, where).not.toMatch(/[«»"]/);
        // French and the others keep their no-break spaces as characters, never as an entity a script would print.
        if (catalog !== 'legal') expect(text, where).not.toMatch(/&nbsp;|&#160;/);
      }
    }
  });
});

describe('the forms of each language', () => {
  it('fill placeholders, count by Intl’s rules and name cards', () => {
    void setLang('fr');
    expect(t('turnOf', { name: 'Ada' })).toBe('Au tour de Ada');
    expect(plural('points', 0)).toBe('0 point');
    expect(plural('points', 1)).toBe('1 point');
    expect(plural('points', 12)).toBe('12 points');
    expect(cardName({ rank: 'Q', suit: 'H' })).toBe('Dame de cœur');
    expect(cardName({ rank: 'JOKER', suit: null })).toBe('Joker');
    expect(rankShort({ rank: 'K' })).toBe('R');
    void setLang('en');
    expect(plural('points', 0)).toBe('0 points');
    expect(plural('points', 1)).toBe('1 point');
    expect(cardName({ rank: 'Q', suit: 'H' })).toBe('Queen of hearts');
    expect(rankShort({ rank: 'K' })).toBe('K');
  });

  it('write places from the dictionary: 1er, 2e; 1st, 2nd, 3rd, 11th', () => {
    void setLang('fr');
    expect([1, 2, 3, 11].map(ordinal)).toEqual(['1er', '2e', '3e', '11e']);
    void setLang('en');
    expect([1, 2, 3, 4, 11, 21, 22].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '21st', '22nd']);
  });

  it('need no plural form but one and other in any language of the list', () => {
    for (const l of LANGUAGES) {
      const forms = new Intl.PluralRules(l.locale).resolvedOptions().pluralCategories;
      // French, Spanish, Italian and Portuguese also have `many` (a million): plural() reads it as `other`.
      expect(
        forms.filter((f) => f !== 'one' && f !== 'other' && f !== 'many'),
        l.code,
      ).toEqual([]);
    }
    expect(new Intl.PluralRules('ja-JP').resolvedOptions().pluralCategories).toEqual(['other']);
    expect(new Intl.PluralRules('zh-Hant-TW').resolvedOptions().pluralCategories).toEqual(['other']);
  });

  it('offers the ready languages, each named in itself', () => {
    expect(languageChoices().map((l) => l.name)).toEqual(['Français', 'English']);
  });
});

describe('the language the game opens in', () => {
  it('is the browser’s first language the game has, French otherwise', () => {
    expect(pickLang(['en-GB', 'fr'])).toBe('en');
    expect(pickLang(['ko-KR', 'fr-CA'])).toBe('fr');
    expect(pickLang(['ko'])).toBe('fr');
    // A language not ready yet is not offered: Spanish opens in the next one the browser knows.
    expect(pickLang(['es-ES', 'en'])).toBe('en');
    expect(pickLang([])).toBe('fr');
  });

  it('is the one picked on this device first, whatever the browser says', () => {
    localStorage.setItem(LANG_KEY, 'fr');
    expect(pickLang(['en-US'])).toBe('fr');
    localStorage.setItem(LANG_KEY, 'en');
    expect(pickLang(['fr-FR'])).toBe('en');
    // An unknown or retired code is ignored.
    localStorage.setItem(LANG_KEY, 'klingon');
    expect(pickLang(['en-US'])).toBe('en');
  });

  it('changes at once for a bundled language, after its file for another, and never to one without a dictionary', async () => {
    await setLang('en', false);
    expect(t('homePlay')).toBe('Play');
    await setLang('de', false);
    expect(currentLang()).toBe('en');
    DICTIONARY_FILES['./de.ts'] = async () => ({ ...fr, homePlay: 'Spielen' });
    const seen: string[] = [];
    const late = setLang('de', false);
    expect(currentLang()).toBe('en');
    await late;
    seen.push(currentLang(), t('homePlay'), document.documentElement.lang);
    expect(seen).toEqual(['de', 'Spielen', 'de']);
    // A slow file that arrives after a later choice does not win.
    DICTIONARY_FILES['./it.ts'] = () => new Promise((ok) => setTimeout(() => ok({ ...fr, homePlay: 'Gioca' }), 20));
    const slow = setLang('it', false);
    await setLang('fr', false);
    await slow;
    expect(currentLang()).toBe('fr');
    delete DICTIONARY_FILES['./de.ts'];
    delete DICTIONARY_FILES['./it.ts'];
  });

  it('links the site’s pages of its language, French’s for one that has none', async () => {
    await setLang('en', false);
    expect(sitePaths()).toEqual({ home: '../en/', legal: '../en/legal/' });
    await setLang('fr', false);
    expect(sitePaths()).toEqual({ home: '../', legal: '../mentions-legales/' });
  });
});

describe('the pseudo-language (?lang=xx-long)', () => {
  it('brackets, accents and lengthens every text, its placeholders untouched', () => {
    const p = pseudoText('Au tour de {name}');
    expect(p).toMatch(/^\[.*\]$/);
    expect(p).toContain('{name}');
    expect(p).not.toMatch(/[A-Za-z]{2}(?![^{]*\})/);
    expect(p.length).toBeGreaterThanOrEqual(Math.floor('Au tour de {name}'.length * 1.3));
    const all = pseudoMessages(fr);
    expect(all.homePlay).toMatch(/^\[.+\]$/);
    expect(all.short_K).toBe(fr.short_K);
    for (const key of Object.keys(fr) as (keyof typeof fr)[])
      expect(placeholders(all[key]), key).toEqual(placeholders(fr[key]));
  });
});

describe('the type of Japanese and Chinese', () => {
  it('has a system font stack for each language whose script the site’s fonts lack', () => {
    const css = readFileSync(resolve(import.meta.dirname, '../src/styles/lang.css'), 'utf8');
    for (const l of LANGUAGES.filter((x) => x.script !== 'latin')) {
      const block = css.match(new RegExp(`:lang\\(${l.html}\\) \\{([^}]+)\\}`))?.[1] ?? '';
      expect(block, l.code).toContain('--f-body');
      expect(block, l.code).toContain('--f-display');
      expect(block, l.code).toMatch(/Noto Sans (JP|SC|TC)/);
    }
  });

  it('flattens nested texts for the lock (the home page’s lists)', () => {
    expect(flatten({ a: 'x', b: [{ t: 'y' }] })).toEqual({ a: 'x', 'b.0.t': 'y' });
  });
});
