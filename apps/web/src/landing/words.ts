import type { LandingText } from './text/fr.ts';

// What the home page's scripts do with its words, whatever the language.

/** "{x} and {y}" → the values given. */
export const fill = (s: string, values: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));

/** A card in a sentence: "un Roi rouge", "an 8". */
export function cardWords(t: LandingText, c: { rank: string; suit: string | null }): string {
  if (c.rank === 'A') return t.cardAce;
  if (c.rank === 'J') return t.cardJack;
  if (c.rank === 'Q') return t.cardQueen;
  if (c.rank === 'K') return fill(t.cardKing, { color: c.suit === 'H' || c.suit === 'D' ? t.red : t.black });
  // English says "an 8"; French has no such case.
  if (c.rank === '8' && t.cardNumber === 'a {n}') return 'an 8';
  return fill(t.cardNumber, { n: c.rank });
}
