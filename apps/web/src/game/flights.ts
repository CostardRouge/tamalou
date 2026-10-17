import type { Card, GameEvent, PlayerId, SlotRef } from '@tamalou/shared';

// Where cards travel when something happens (the owner's "trajectoires physiques" with the soft physics of design D,
// 2026-10-17), and what the other players say while they play (design A of "voir jouer les autres"). Pure: events in,
// flights and bubbles out; Flights.tsx measures the places on screen and flies the cards.

/** A place on the table a card can leave or reach: `deck`, `discard`, `drawn`, or `slot:<player>:<slot>`. */
export type Place = string;

export const slotPlace = (ref: SlotRef): Place => `slot:${ref.player}:${ref.slot}`;

export interface Flight {
  from: Place;
  to: Place;
  /** The face shown while it flies, null for a face-down card. */
  card: Card | null;
  /** Shown face up only on the way (a card leaving a hand for the discard turns over in the air). */
  turnsOver?: boolean;
  /** A quick discard is thrown: a stiffer, faster spring. */
  thrown?: boolean;
  /**
   * Its beat in the batch: moves that arrive together (a bot draws and swaps at once) play one after the other, and a
   * swap reads as "in, then out".
   */
  beat: number;
}

export function flightsOf(events: readonly GameEvent[], me: PlayerId): Flight[] {
  const out: Flight[] = [];
  // The card I just drew is known to me through a private event that comes with the public one.
  const mine = new Map<PlayerId, Card>();
  for (const e of events) {
    if (e.type === 'drewCard') mine.set(e.to, e.card);
  }
  let beat = 0;
  const fly = (f: Omit<Flight, 'beat'>, after = 0) => out.push({ ...f, beat: beat + after });
  for (const e of events) {
    const before = out.length;
    let span = 1;
    switch (e.type) {
      case 'drew':
        fly({ from: e.from, to: 'drawn', card: e.card ?? (e.player === me ? (mine.get(me) ?? null) : null) });
        break;
      case 'swapped':
        fly({ from: 'drawn', to: slotPlace({ player: e.player, slot: e.slot }), card: null });
        fly(
          { from: slotPlace({ player: e.player, slot: e.slot }), to: 'discard', card: e.discarded, turnsOver: true },
          1,
        );
        span = 2;
        break;
      case 'discarded':
        fly({ from: 'drawn', to: 'discard', card: e.card });
        break;
      case 'cardsSwapped':
        fly({ from: slotPlace(e.a), to: slotPlace(e.b), card: null });
        fly({ from: slotPlace(e.b), to: slotPlace(e.a), card: null });
        break;
      case 'quickDiscard':
        fly({ from: slotPlace(e.target), to: 'discard', card: e.card, turnsOver: true, thrown: true });
        if (e.give !== undefined) {
          fly({ from: slotPlace({ player: e.player, slot: e.give }), to: slotPlace(e.target), card: null }, 1);
          span = 2;
        }
        break;
      case 'quickDiscardFailed':
        for (const slot of e.penalty) fly({ from: 'deck', to: slotPlace({ player: e.player, slot }), card: null });
        break;
      default:
        break;
    }
    if (out.length > before) beat += span;
  }
  return out;
}

/** What another player says while playing, one short line per move worth a word. */
export interface Bubble {
  player: PlayerId;
  key:
    | 'bubbleDraw'
    | 'bubbleTake'
    | 'bubbleKeep'
    | 'bubbleThrow'
    | 'bubblePeekOwn'
    | 'bubblePeekYou'
    | 'bubblePeekOther'
    | 'bubbleSwapYou'
    | 'bubbleSwap'
    | 'bubbleQuick'
    | 'bubbleMissed';
  /** For a line naming a card: "Je jette le 7." */
  card?: Card;
}

export function bubblesOf(events: readonly GameEvent[], me: PlayerId): Bubble[] {
  const said = new Map<PlayerId, Bubble>();
  const say = (b: Bubble) => {
    if (b.player !== me) said.set(b.player, b);
  };
  for (const e of events) {
    switch (e.type) {
      case 'drew':
        say({ player: e.player, key: e.from === 'deck' ? 'bubbleDraw' : 'bubbleTake' });
        break;
      case 'swapped':
        say({ player: e.player, key: 'bubbleKeep' });
        break;
      case 'discarded':
        say({ player: e.player, key: 'bubbleThrow', card: e.card });
        break;
      case 'powerUsed': {
        const [first, second] = e.targets;
        if (!first) break;
        if (second) {
          const withMe = first.player === me || second.player === me;
          say({ player: e.player, key: withMe ? 'bubbleSwapYou' : 'bubbleSwap' });
        } else if (first.player === e.player) say({ player: e.player, key: 'bubblePeekOwn' });
        else say({ player: e.player, key: first.player === me ? 'bubblePeekYou' : 'bubblePeekOther' });
        break;
      }
      case 'quickDiscard':
        say({ player: e.player, key: 'bubbleQuick', card: e.card });
        break;
      case 'quickDiscardFailed':
        say({ player: e.player, key: 'bubbleMissed' });
        break;
      default:
        break;
    }
  }
  return [...said.values()];
}
