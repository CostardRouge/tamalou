import type { Card } from '@tamalou/shared';
import {
  detectLang,
  isLang,
  isReadyLang,
  LANGUAGES,
  type Lang,
  language,
  legalDir,
  READY_LANGS,
} from '@tamalou/shared/languages';
import { en } from './en.ts';
import { fr, type Messages } from './fr.ts';
import { PSEUDO, rememberLang, storedLang } from './remember.ts';

// Every user-facing text goes through t() (ADR-0028). French is the source and the default; English ships in the
// bundle beside it; every other language is a file of its own, fetched when chosen (`import()`, and cached for offline
// play by the service worker like the rest of the build). Which language: `?lang=` in the address, else the one picked
// on this device, else the first of the browser's languages that is offered, else French.

export type Key = keyof Messages;
export type { Lang } from '@tamalou/shared/languages';

const DICTS: Partial<Record<Lang, Messages>> = { fr, en };

/**
 * The other dictionaries, one file each (`src/i18n/<code>.ts`, `export default`), loaded on demand. Exported for the
 * tests, which add one to try the loading.
 */
export const DICTIONARY_FILES: Record<string, () => Promise<Messages>> = import.meta.glob<Messages>(
  './{es,it,pt,de,ja,zh-Hans,zh-Hant}.ts',
  { import: 'default' },
);
const loaderOf = (l: Lang) => DICTIONARY_FILES[`./${l}.ts`];

/** The languages that can be shown: in the bundle, or with a file to load. */
export const hasDictionary = (l: Lang) => Boolean(DICTS[l] ?? loaderOf(l));

/** The languages the selector offers: the ready ones (packages/shared languages.ts). */
export const LANGS: Lang[] = READY_LANGS.filter(hasDictionary);

/** What the address forces (`?lang=es`, or the development pseudo-language `?lang=xx-long`), if anything. */
function forced(): Lang | typeof PSEUDO | null {
  try {
    const q = new URLSearchParams(globalThis.location?.search ?? '').get('lang');
    if (q === PSEUDO) return PSEUDO;
    if (isLang(q) && hasDictionary(q)) return q;
  } catch {
    // No location (tests): nothing forced.
  }
  return null;
}

/** The language to open in: forced, else picked on this device, else the browser's, else French. */
export function pickLang(browser: readonly string[] = globalThis.navigator?.languages ?? []): Lang | typeof PSEUDO {
  const q = forced();
  if (q) return q;
  const stored = storedLang();
  if (isReadyLang(stored) && hasDictionary(stored)) return stored;
  return detectLang(browser, LANGS) ?? 'fr';
}

const first = pickLang();
let lang: Lang = first === PSEUDO ? 'fr' : first;
/** The pseudo-language's dictionary while it is on (`?lang=xx-long`): every French text, accented, longer, bracketed. */
let pseudo: Messages | null = null;
const listeners = new Set<(l: Lang) => void>();
/** The last language asked for: a slow file arriving after a later choice is ignored. */
let wanted: Lang = lang;

async function load(l: Lang): Promise<Messages> {
  const known = DICTS[l];
  if (known) return known;
  const loader = loaderOf(l);
  if (!loader) return fr;
  const dict = await loader();
  DICTS[l] = dict;
  return dict;
}

function apply(l: Lang, remember: boolean): void {
  lang = l;
  pseudo = null;
  if (remember) rememberLang(l);
  if (globalThis.document) document.documentElement.lang = language(l).html;
  for (const fn of listeners) fn(l);
}

/**
 * Changes the language, remembers it on this device (unless told not to) and tells the screens to draw again, once
 * its dictionary is here: at once for French and English, after the file arrives for the others. A file that cannot
 * be fetched (offline before it was ever cached) leaves the language as it was: never a screen in two languages.
 */
export function setLang(l: Lang, remember = true): Promise<void> {
  if (!hasDictionary(l)) return Promise.resolve();
  wanted = l;
  if (DICTS[l]) {
    apply(l, remember);
    return Promise.resolve();
  }
  return load(l).then(
    () => {
      if (wanted === l) apply(l, remember);
    },
    () => {
      wanted = lang;
    },
  );
}

/** Resolves once the language the game opens in can be drawn: the screen waits for it (main.tsx). */
export const ready: Promise<void> = (async () => {
  if (first === PSEUDO) {
    const { pseudoMessages } = await import('./pseudo.ts');
    pseudo = pseudoMessages(fr);
    return;
  }
  if (DICTS[lang]) return;
  try {
    await load(lang);
  } catch {
    lang = 'fr';
  }
})();

export const currentLang = () => lang;
/** The `Intl` locale of the language on screen: dates, lists, plurals. */
export const currentLocale = () => language(lang).locale;
export function onLangChange(fn: (l: Lang) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const dict = (): Messages => pseudo ?? DICTS[lang] ?? fr;

export function t(key: Key, params: Record<string, string | number> = {}): string {
  const text = dict()[key] ?? fr[key];
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

/** The `_one` / `_other` pair of a key, by the language's plural rule (`Intl`: French counts 0 as singular, Japanese and Chinese have one form). */
export function plural(base: string, n: number, params: Record<string, string | number> = {}): string {
  const one = new Intl.PluralRules(currentLocale()).select(n) === 'one';
  return t(`${base}_${one ? 'one' : 'other'}` as Key, { n, ...params });
}

/** A place: «1er», «2e»; "1st", "2nd"; each language's forms are keys (`ordinal_one`… `ordinal_other`). */
export function ordinal(n: number): string {
  const form = new Intl.PluralRules(currentLocale(), { type: 'ordinal' }).select(n);
  const key = `ordinal_${form}`;
  return t((key in fr ? key : 'ordinal_other') as Key, { n });
}

export function rankName(card: Pick<Card, 'rank'>): string {
  return t(`rank_${card.rank}` as Key);
}

/** "Dame de cœur", "Joker". */
export function cardName(card: Pick<Card, 'rank' | 'suit'>): string {
  if (card.suit === null) return rankName(card);
  return t('cardOf', { rank: rankName(card), suit: t(`suit_${card.suit}` as Key) });
}

/** The corner index of a card: "A", "7", "D" for a queen in French. */
export function rankShort(card: Pick<Card, 'rank'>): string {
  if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return t(`short_${card.rank}` as Key);
  if (card.rank === 'JOKER') return '★';
  return card.rank;
}

/** A preset's name and description in the current language (the shared package carries the French ones). */
export function presetText(id: string, fallback: { name: string; description: string }) {
  const name = `preset_${id}` as Key;
  const description = `presetDesc_${id}` as Key;
  return {
    name: name in fr ? t(name) : fallback.name,
    description: description in fr ? t(description) : fallback.description,
  };
}

/**
 * The site's pages in the language on screen, from the game (`play/`): its home page and its legal notice; French's
 * for a language that has no pages yet (forced with `?lang=` before it is ready).
 */
export function sitePaths(): { home: string; legal: string } {
  const l = isReadyLang(lang) ? lang : 'fr';
  return { home: `../${language(l).dir}`, legal: `../${legalDir(l)}` };
}

/** The languages a list offers, each named in itself, for the settings and the site's pages alike. */
export const languageChoices = () => LANGUAGES.filter((l) => LANGS.includes(l.code));
