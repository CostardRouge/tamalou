import type { Card, CardId, Phase, PlayerId, Power, RoundResult, SlotRef, Step } from '@tamalou/shared';

// The full game state. It is the authority's alone: nothing outside the engine reads it except through viewFor().
// Plain JSON (no Map, no Set, no class) so a Durable Object can store it and a test can deep-compare it.

export interface Seat {
  id: PlayerId;
  name: string;
  total: number;
  eliminated: boolean;
}

export interface GameState {
  /** The seed the game was created with; `rng` is the generator's current state. */
  seed: number;
  rng: number;
  /** Every physical card of the game, indexed by id. Never changes. */
  cards: Card[];
  players: Seat[];
  round: number;
  phase: Phase;
  step: Step | null;
  current: PlayerId | null;
  /** Seat index of the round's first player; moves one active seat each round. */
  starter: number;
  /** Top of the pile is the last element. */
  deck: CardId[];
  /** Top of the discard is the last element. */
  discard: CardId[];
  /** Grids by player; null is a slot emptied by a quick discard. An eliminated player holds nothing. */
  hands: Record<PlayerId, (CardId | null)[]>;
  drawn: { card: CardId; from: 'deck' | 'discard' } | null;
  pendingPower: { player: PlayerId; power: Power } | null;
  reveal: { player: PlayerId; power: Power; target: SlotRef; card: CardId } | null;
  /** The quick-discard window (ADR-0005). */
  window: boolean;
  caller: PlayerId | null;
  lastTurns: PlayerId[];
  /** Own turns completed this round, by player. */
  turns: Record<PlayerId, number>;
  /** Initial peek: chosen slots (null until chosen) and readiness. */
  peek: Record<PlayerId, { slots: number[] | null; ready: boolean }>;
  /** Card ids each player has legitimately seen this round (beginner mode, bots' ground truth in tests). */
  knows: Record<PlayerId, CardId[]>;
  results: RoundResult[];
  winners: PlayerId[] | null;
}

export type EngineError =
  | 'wrongPhase'
  | 'wrongStep'
  | 'notYourTurn'
  | 'notAPlayer'
  | 'eliminated'
  | 'badSlot'
  | 'emptySlot'
  | 'lockedSlot'
  | 'badTargets'
  | 'mustSwap'
  | 'deckEmpty'
  | 'discardEmpty'
  | 'alreadyChosen'
  | 'notChosen'
  | 'alreadyReady'
  | 'callNotAllowed'
  | 'quickDiscardDisabled'
  | 'windowClosed'
  | 'staleTop'
  | 'opponentCardsDisabled'
  | 'badGive'
  | 'notHost';

export const activePlayers = (s: GameState): Seat[] => s.players.filter((p) => !p.eliminated);

export const seatOf = (s: GameState, id: PlayerId): Seat | undefined => s.players.find((p) => p.id === id);

export const cardOf = (s: GameState, id: CardId): Card => {
  const c = s.cards[id];
  if (!c) throw new Error(`no card ${id}`);
  return c;
};

export const topOfDiscard = (s: GameState): CardId | null => s.discard[s.discard.length - 1] ?? null;

export const slotCard = (s: GameState, ref: SlotRef): CardId | null => s.hands[ref.player]?.[ref.slot] ?? null;

export const filledSlots = (s: GameState, player: PlayerId): number[] =>
  (s.hands[player] ?? []).flatMap((c, i) => (c === null ? [] : [i]));

/** A slot the others' powers and claims cannot touch: the caller's, when lockCallerCards is on. */
export const isLocked = (s: GameState, lockCallerCards: boolean, ref: SlotRef, by: PlayerId): boolean =>
  lockCallerCards && s.caller !== null && ref.player === s.caller && by !== s.caller;
