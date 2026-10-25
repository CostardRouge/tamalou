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
  /** Dealt at the start of a round: a quick, soft glide, one card after the other. */
  dealt?: boolean;
  /**
   * Whose hand moves it, when the screen shows the others' hands (FlightLayer): absent for the deal and for penalty
   * cards, which the deck gives.
   */
  by?: PlayerId;
  /** With a hand: no card moves, the hand only touches `from` (a power's target: a card looked at, or chosen). */
  tap?: boolean;
  /** With a hand: it leaves as soon as the hand picks up the move before it (the other half of an exchange). */
  alongside?: boolean;
  /** With a hand: a place it rests over first, weighing it up, before going for the card (a swap's choice). */
  hover?: Place;
  /**
   * Its beat in the batch: moves that arrive together (a bot draws and swaps at once) play one after the other, and a
   * swap reads as "in, then out".
   */
  beat: number;
}

/** The gap between two dealt cards, in beats: a round of four hands for four players takes about a second and a half. */
export const DEAL_STEP = 0.25;

/**
 * `handOf` says how many cards each player is dealt (the round's hands, read from the view: the event does not carry
 * it).
 */
export function flightsOf(
  events: readonly GameEvent[],
  me: PlayerId,
  handOf: (player: PlayerId) => number = () => 4,
): Flight[] {
  const out: Flight[] = [];
  // The card I just drew is known to me through a private event that comes with the public one.
  const mine = new Map<PlayerId, Card>();
  for (const e of events) {
    if (e.type === 'drewCard') mine.set(e.to, e.card);
  }
  let beat = 0;
  const fly = (f: Omit<Flight, 'beat'>, after = 0) => out.push({ ...f, beat: beat + after });
  // Taps are only played by a hand: they take no beat from the cards flying on their own.
  let taps = 0;
  for (const e of events) {
    const before = out.length;
    let span = 1;
    switch (e.type) {
      case 'roundStarted': {
        // Dealt as at a real table: one card at a time round the table from the starter, then the discard's first
        // card turned over. The flights land on the hands already drawn, so the game is on screen from the start.
        const at = Math.max(0, e.players.indexOf(e.starter));
        const order = [...e.players.slice(at), ...e.players.slice(0, at)];
        const most = Math.max(0, ...order.map(handOf));
        let k = 0;
        for (let slot = 0; slot < most; slot++) {
          for (const player of order) {
            if (slot >= handOf(player)) continue;
            fly({ from: 'deck', to: slotPlace({ player, slot }), card: null, dealt: true }, k * DEAL_STEP);
            k++;
          }
        }
        fly({ from: 'deck', to: 'discard', card: e.discardTop, turnsOver: true, dealt: true }, k * DEAL_STEP + 0.5);
        span = Math.ceil(k * DEAL_STEP) + 2;
        break;
      }
      case 'drew':
        fly({
          from: e.from,
          to: 'drawn',
          card: e.card ?? (e.player === me ? (mine.get(me) ?? null) : null),
          by: e.player,
        });
        break;
      case 'swapped': {
        // The hand weighs up a neighbouring card before going for the one it swaps.
        const n = handOf(e.player);
        const hover = n > 1 ? slotPlace({ player: e.player, slot: (e.slot + 1) % n }) : undefined;
        fly({ from: 'drawn', to: slotPlace({ player: e.player, slot: e.slot }), card: null, by: e.player, hover });
        fly(
          {
            from: slotPlace({ player: e.player, slot: e.slot }),
            to: 'discard',
            card: e.discarded,
            turnsOver: true,
            by: e.player,
          },
          1,
        );
        span = 2;
        break;
      }
      case 'discarded':
        fly({ from: 'drawn', to: 'discard', card: e.card, by: e.player });
        break;
      case 'powerUsed':
        for (const target of e.targets) {
          out.push({ from: slotPlace(target), to: slotPlace(target), card: null, by: e.player, tap: true, beat });
          taps++;
        }
        break;
      case 'cardsSwapped':
        fly({ from: slotPlace(e.a), to: slotPlace(e.b), card: null, by: e.player });
        fly({ from: slotPlace(e.b), to: slotPlace(e.a), card: null, by: e.player, alongside: true });
        break;
      case 'quickDiscard':
        fly({ from: slotPlace(e.target), to: 'discard', card: e.card, turnsOver: true, thrown: true, by: e.player });
        if (e.give !== undefined) {
          fly(
            { from: slotPlace({ player: e.player, slot: e.give }), to: slotPlace(e.target), card: null, by: e.player },
            1,
          );
          span = 2;
        }
        break;
      case 'quickDiscardFailed':
        for (const slot of e.penalty) fly({ from: 'deck', to: slotPlace({ player: e.player, slot }), card: null });
        break;
      default:
        break;
    }
    if (out.length - taps > before) beat += span;
    taps = 0;
  }
  return out;
}

/**
 * Where a table opening now should start playing from: the round's deal, when nothing but the initial peek happened
 * since (the game was just started, or a shared screen shows a player their hand for the first time); otherwise
 * nothing, and only what comes next moves.
 */
export function dealToReplay(events: readonly GameEvent[]): number | undefined {
  const at = events.findLastIndex((e) => e.type === 'roundStarted');
  if (at < 0) return undefined;
  const quiet = events.slice(at + 1).every((e) => e.type === 'initialPeek' || e.type === 'playerReady');
  return quiet ? at : undefined;
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
