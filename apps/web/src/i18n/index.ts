import type { Card } from '@tamalou/shared';
import { en } from './en.ts';
import { fr, type Messages } from './fr.ts';

// Every user-facing text goes through t(). French is the game's language; English is ready behind ?lang=en until a
// switch exists (M8).

export type Key = keyof Messages;
export type Lang = 'fr' | 'en';

const DICTS: Record<Lang, Messages> = { fr, en };

function pickLang(): Lang {
  try {
    const q = new URLSearchParams(globalThis.location?.search ?? '').get('lang');
    if (q === 'en' || q === 'fr') return q;
  } catch {
    // No location (tests): French.
  }
  return 'fr';
}

let lang: Lang = pickLang();
export const setLang = (l: Lang) => {
  lang = l;
};
export const currentLang = () => lang;

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
