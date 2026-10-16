// The cards themselves: ranks, suits, and how a card is identified. A card is an id into the game's card table;
// the table never changes during a game, only where each id sits.

export const SUITS = ['S', 'H', 'D', 'C'] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'JOKER'] as const;
export type Rank = (typeof RANKS)[number];

/** The thirteen ranks of a standard deck, jokers excluded. */
export const STANDARD_RANKS = RANKS.filter((r) => r !== 'JOKER') as Exclude<Rank, 'JOKER'>[];

export const RED_SUITS: readonly Suit[] = ['H', 'D'];

export type CardId = number;

export interface Card {
  id: CardId;
  rank: Rank;
  /** null for a joker. */
  suit: Suit | null;
  /** Which physical deck it comes from (0 or 1), so two identical faces stay two cards. */
  deck: number;
}

const SUIT_NAMES: Record<Suit, string> = { S: 'pique', H: 'cœur', D: 'carreau', C: 'trèfle' };
const RANK_NAMES: Record<Rank, string> = {
  A: 'As',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  J: 'Valet',
  Q: 'Dame',
  K: 'Roi',
  JOKER: 'Joker',
};

/** A short French label, for logs and the simulation CLI; the UI goes through its own dictionaries. */
export function cardLabel(card: Pick<Card, 'rank' | 'suit'>): string {
  if (card.suit === null) return RANK_NAMES[card.rank];
  return `${RANK_NAMES[card.rank]} de ${SUIT_NAMES[card.suit]}`;
}
