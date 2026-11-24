// How this device's player likes their cards (the owner, 2026-11-24: «pouvoir choisir le design des cartes»): the back's
// colour, its pattern, the mark in its middle, and an effect on the cards. A device setting, like the hand's layout: it
// changes how this screen draws the cards, never what the others see. The card theme reads it (classic.tsx), so a deck
// of the owner's own can take it or leave it.

export const BACK_COLORS = ['cobalt', 'vermilion', 'emerald', 'violet', 'night', 'bordeaux'] as const;
export const PATTERNS = ['stripes', 'diamonds', 'dots', 'checks', 'plain'] as const;
export const EFFECTS = ['none', 'iris', 'holo'] as const;

export type BackColor = (typeof BACK_COLORS)[number];
export type Pattern = (typeof PATTERNS)[number];
export type Effect = (typeof EFFECTS)[number];

export interface DeckStyle {
  color: BackColor;
  pattern: Pattern;
  /** One or two characters in the middle of the back; empty for none. */
  mark: string;
  effect: Effect;
}

/** The back's colour, the same in both themes (a card is a physical thing); the mark is BACK_INK on it, ≥ 4.5:1. */
export const BACK_HEX: Record<BackColor, string> = {
  cobalt: '#2743f5',
  vermilion: '#b5361a',
  emerald: '#11704b',
  violet: '#6a35b8',
  night: '#1d2233',
  bordeaux: '#7a1f3d',
};
export const BACK_INK = '#eef1ff';

export const DEFAULT_DECK: DeckStyle = { color: 'cobalt', pattern: 'stripes', mark: 'T', effect: 'none' };

export const MAX_MARK = 2;

/** At most two characters as a person sees them (an emoji counts as one). */
export function cleanMark(typed: string): string {
  const segments = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(typed.trim())];
  return segments
    .slice(0, MAX_MARK)
    .map((s) => s.segment)
    .join('');
}

const one = <T extends string>(list: readonly T[], x: unknown, fallback: T): T =>
  list.includes(x as T) ? (x as T) : fallback;

/** A stored style, each part checked on its own: a bad one falls back to its default. */
export function readDeck(raw: unknown): DeckStyle {
  const d = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    color: one(BACK_COLORS, d.color, DEFAULT_DECK.color),
    pattern: one(PATTERNS, d.pattern, DEFAULT_DECK.pattern),
    mark: typeof d.mark === 'string' ? cleanMark(d.mark) : DEFAULT_DECK.mark,
    effect: one(EFFECTS, d.effect, DEFAULT_DECK.effect),
  };
}
