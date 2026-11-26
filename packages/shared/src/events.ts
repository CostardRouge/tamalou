import type { PlayerId, SlotRef } from './actions.ts';
import type { Card } from './cards.ts';
import type { Power } from './rules.ts';

// What happened, as the engine reports it. An event with `to` is private to that player; every other event is
// public. A transport sends a player the public events and their own: never another player's private event.

export interface RoundScore {
  player: PlayerId;
  /** Sum of the cards left in hand. */
  hand: number;
  /** What is added to the total: the hand, adjusted for a failed or winning call. */
  scored: number;
  total: number;
}

export interface RoundResult {
  round: number;
  caller: PlayerId | null;
  callerFailed: boolean;
  scores: RoundScore[];
  eliminated: PlayerId[];
}

export type GameEvent =
  | { type: 'roundStarted'; round: number; starter: PlayerId; players: PlayerId[]; discardTop: Card }
  | { type: 'initialPeek'; to: PlayerId; cards: { slot: number; card: Card }[] }
  | { type: 'playerReady'; player: PlayerId }
  | { type: 'playStarted'; current: PlayerId }
  | { type: 'drew'; player: PlayerId; from: 'deck' | 'discard'; card?: Card }
  | { type: 'drewCard'; to: PlayerId; card: Card }
  | { type: 'swapped'; player: PlayerId; slot: number; discarded: Card }
  | { type: 'discarded'; player: PlayerId; card: Card }
  | { type: 'powerOffered'; player: PlayerId; power: Power }
  | { type: 'powerSkipped'; player: PlayerId; power: Power }
  | { type: 'powerUsed'; player: PlayerId; power: Power; targets: SlotRef[] }
  | { type: 'peeked'; to: PlayerId; target: SlotRef; card: Card }
  | { type: 'cardsSwapped'; player: PlayerId; a: SlotRef; b: SlotRef; power: Power }
  | { type: 'quickDiscard'; player: PlayerId; target: SlotRef; card: Card }
  /**
   * The claimer's card `slot` went, face down, into the opponent's slot their claim emptied. Public: named `into`,
   * since a `to` field makes an event private (isVisibleTo).
   */
  | { type: 'cardGiven'; player: PlayerId; slot: number; into: SlotRef }
  | { type: 'quickDiscardFailed'; player: PlayerId; target: SlotRef; card: Card; penalty: number[] }
  | { type: 'deckReshuffled'; size: number }
  | { type: 'penaltySkipped'; player: PlayerId; missing: number }
  /** `empty`: called for them, their hand empty (`round.emptyHand: 'callsTamalou'`). */
  | { type: 'tamalouCalled'; player: PlayerId; empty?: true }
  | { type: 'callPassed'; player: PlayerId }
  | { type: 'turnStarted'; player: PlayerId }
  | { type: 'lastTurns'; players: PlayerId[] }
  | { type: 'handsRevealed'; hands: { player: PlayerId; cards: (Card | null)[] }[] }
  | { type: 'roundEnded'; result: RoundResult }
  | { type: 'gameEnded'; winners: PlayerId[]; totals: { player: PlayerId; total: number }[] };

export type GameEventType = GameEvent['type'];

export function isVisibleTo(event: GameEvent, player: PlayerId): boolean {
  return !('to' in event) || event.to === player;
}
