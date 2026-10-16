import type { Card } from '@tamalou/shared';
import { en } from './en.ts';
import { fr, type Messages } from './fr.ts';

// Every user-facing text goes through t(). French is the game's language and the default; English is one tap away on
// the home screen (remembered on this device), or forced with ?lang=en.

export type Key = keyof Messages;
export type Lang = 'fr' | 'en';
export const LANGS: Lang[] = ['fr', 'en'];

const DICTS: Record<Lang, Messages> = { fr, en };
const LANG_KEY = 'tamalou-lang';

function pickLang(): Lang {
  try {
    const q = new URLSearchParams(globalThis.location?.search ?? '').get('lang');
    if (q === 'en' || q === 'fr') return q;
    const stored = globalThis.localStorage?.getItem(LANG_KEY);
    if (stored === 'en' || stored === 'fr') return stored;
  } catch {
    // No location or storage (tests, private windows): French.
  }
  return 'fr';
}

let lang: Lang = pickLang();
const listeners = new Set<(l: Lang) => void>();

/** Changes the language, remembers it on this device and tells the screens to draw again. */
export function setLang(l: Lang): void {
  lang = l;
  try {
    globalThis.localStorage?.setItem(LANG_KEY, l);
  } catch {
    // Not remembered: the next visit starts in French.
  }
  if (globalThis.document) document.documentElement.lang = l;
  for (const fn of listeners) fn(l);
}
export const currentLang = () => lang;
export function onLangChange(fn: (l: Lang) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function t(key: Key, params: Record<string, string | number> = {}): string {
  const text = DICTS[lang][key] ?? fr[key];
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

/** The `_one` / `_other` pair of a key, by the language's plural rule (French counts 0 and 1 as singular). */
export function plural(base: string, n: number, params: Record<string, string | number> = {}): string {
  const one = lang === 'fr' ? n <= 1 : n === 1;
  return t(`${base}_${one ? 'one' : 'other'}` as Key, { n, ...params });
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
    name: name in DICTS[lang] ? t(name) : fallback.name,
    description: description in DICTS[lang] ? t(description) : fallback.description,
  };
}
