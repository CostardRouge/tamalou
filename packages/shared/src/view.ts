import type { PlayerId, SlotRef } from './actions.ts';
import type { Card } from './cards.ts';
import type { RoundResult } from './events.ts';
import type { Power } from './rules.ts';

// What one player is allowed to see: built by the engine's viewFor(), the only thing a UI, a bot or a socket ever
// receives. A card face appears in it only when that player may know it right now.

export type Phase = 'initialPeek' | 'play' | 'roundEnding' | 'roundOver' | 'gameOver';
/** Within `play`, what the current player owes. */
export type Step = 'draw' | 'place' | 'power' | 'reveal' | 'callDecision';

export interface SlotView {
  slot: number;
  /** false once the card left by a quick discard. */
  filled: boolean;
  /** The face, only when this player may see it now (their peek, the round's end, beginner mode). */
  card: Card | null;
  /** Locked by a Tamalou call: out of the others' powers and claims. */
  locked: boolean;
}

export interface PlayerSeatView {
  id: PlayerId;
  name: string;
  total: number;
  eliminated: boolean;
  slots: SlotView[];
}

export interface PlayerView {
  me: PlayerId;
  round: number;
  phase: Phase;
  step: Step | null;
  current: PlayerId | null;
  players: PlayerSeatView[];
  deckSize: number;
  discardSize: number;
  discardTop: Card | null;
  /** The card the current player holds: its face only for that player. */
  drawn: { from: 'deck' | 'discard'; card: Card | null } | null;
  /** A power waiting for its user's choice, public. */
  pendingPower: { player: PlayerId; power: Power } | null;
  /** A look in progress: the face only for the player looking. */
  reveal: { player: PlayerId; power: Power; target: SlotRef; card: Card | null } | null;
  quickDiscardOpen: boolean;
  caller: PlayerId | null;
  /** Players still owed their last turn after a call. */
  lastTurns: PlayerId[];
  /** Initial peek phase: whether each player is done. */
  ready: PlayerId[];
  /** Initial peek phase: the slots this player looks at (null until chosen, in choose mode). */
  myPeekSlots: number[] | null;
  /** This player's own turns played this round (for minTurnsBeforeCall). */
  myTurns: number;
  lastResult: RoundResult | null;
  winners: PlayerId[] | null;
}
