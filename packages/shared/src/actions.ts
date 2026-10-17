import type { CardId } from './cards.ts';

// Intentions: what a player (or the host) asks the engine to do. The engine checks each one against the state and
// the RuleSet and refuses it with a code when it is not legal; a client never applies its own action.

export type PlayerId = string;

/** A position in someone's grid. Slots keep their index for the whole round, even once emptied. */
export interface SlotRef {
  player: PlayerId;
  slot: number;
}

export type Action =
  /** Initial peek, choose mode: the slots this player looks at. */
  | { type: 'choosePeek'; by: PlayerId; slots: number[] }
  /** Initial peek: done memorising. Play starts once every player is ready. */
  | { type: 'ready'; by: PlayerId }
  | { type: 'draw'; by: PlayerId; from: 'deck' | 'discard' }
  /** Put the drawn card in this own slot; the card that was there goes face up on the discard. */
  | { type: 'swap'; by: PlayerId; slot: number }
  /** Put the drawn card straight on the discard (a card from the discard only when discardPickup.mustSwap is off). */
  | { type: 'discardDrawn'; by: PlayerId }
  /**
   * Use the power of the card just discarded. Targets by power: peekOwn [own slot], peekOther [opponent slot],
   * blindSwap [own slot, opponent slot], peekThenSwap [any slot].
   */
  | { type: 'usePower'; by: PlayerId; targets: SlotRef[] }
  | { type: 'skipPower'; by: PlayerId }
  /** Done looking at a peeked card. */
  | { type: 'endReveal'; by: PlayerId }
  /** Queen, after the look: swap the looked-at card with a card on the other side, or keep everything (null). */
  | { type: 'queenDecide'; by: PlayerId; swapWith: SlotRef | null }
  | { type: 'callTamalou'; by: PlayerId }
  /** endOfTurn timing: decline the call offered after this player's turn. */
  | { type: 'passCall'; by: PlayerId }
  /**
   * Claim the card at `target` matches the discard's top rank. An opponent's card needs allowOpponentCards and
   * `give`, the claimer's own slot handed to that opponent on a match. `expectTop` is the discard's top card the
   * claim was aimed at: if another claim changed it first, this one is cancelled without penalty.
   */
  | { type: 'quickDiscard'; by: PlayerId; target: SlotRef; expectTop: CardId; give?: number }
  /** Host: close the last quick-discard window and score the round. */
  | { type: 'endRound'; by: 'host' }
  /** Host: deal the next round. */
  | { type: 'nextRound'; by: 'host' };

export type ActionType = Action['type'];
