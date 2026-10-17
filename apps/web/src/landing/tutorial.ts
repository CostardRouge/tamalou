import type { Rank, Suit } from '@tamalou/shared';

/**
 * The home page's first round (ADR-0016, direction B chosen by the owner): a visitor plays one guided round against a
 * slow bot, right on the page. A small reducer, not the engine: the deck is fixed so the round always teaches the same
 * moves (peek, draw, swap, discard, a power, a quick discard, the call) and a sensible player wins it. The React side
 * (tutorial.tsx) draws the state and plays the `after` steps on a timer. Values follow the default rules; a test checks
 * them against the engine's `cardValue`.
 */

export interface TCard {
  id: number;
  rank: Rank;
  suit: Suit;
}

export type Phase = 'peek' | 'wait' | 'turn' | 'drawn' | 'powerOwn' | 'powerOther' | 'quick' | 'bot' | 'end';
export type Move = 'peek' | 'draw' | 'swap' | 'discard' | 'power' | 'quick' | 'tamalou';
export const MOVES: Move[] = ['peek', 'draw', 'swap', 'discard', 'power', 'quick', 'tamalou'];

/** What the last move said, for the coach's line; the card is the one it names. */
export type Note =
  | { k: 'swapOut'; card: TCard }
  | { k: 'quickHit' }
  | { k: 'quickMiss' }
  | { k: 'botSwap'; card: TCard }
  | { k: 'botDiscard'; card: TCard };

export interface Tut {
  phase: Phase;
  /** Your turns so far, from 1. */
  turn: number;
  you: (TCard | null)[];
  bot: TCard[];
  /** Top first. */
  deck: TCard[];
  /** Top last. */
  disc: TCard[];
  held: TCard | null;
  from: 'deck' | 'disc' | null;
  botHeld: TCard | null;
  peek: boolean[];
  /** The slots whose card you know. */
  seen: boolean[];
  botPeek: boolean[];
  called: boolean;
  splash: boolean;
  learned: Move[];
  note: Note | null;
}

export type TAction =
  | { t: 'tapMine'; i: number }
  | { t: 'tapBot'; i: number }
  | { t: 'draw'; from: 'deck' | 'disc' }
  | { t: 'discard' }
  | { t: 'tamalou' }
  | { t: 'letPass' }
  | { t: 'restart' }
  // Timed steps, scheduled by the reducer itself through `after`.
  | { t: 'hide' }
  | { t: 'botTurn' }
  | { t: 'botPlay' }
  | { t: 'botDone' }
  | { t: 'nextTurn' };

export interface Step {
  state: Tut;
  /** A step to play after a pause, so the visitor sees what happened. */
  after?: { ms: number; action: TAction };
}

const SPEC = (s: string, id: number): TCard => {
  const [rank, suit] = s.split('-') as [Rank, Suit];
  return { id, rank, suit };
};

export function freshTut(): Tut {
  let id = 0;
  const cards = (specs: string[]) => specs.map((s) => SPEC(s, id++));
  return {
    phase: 'peek',
    turn: 1,
    you: cards(['8-D', 'Q-C', '3-S', 'K-H']),
    bot: cards(['9-C', '4-S', 'J-D', '6-H']),
    deck: cards(['2-C', '10-S', '7-H', '3-D', '5-C', 'A-H', '4-C', '8-S', '6-D', '2-D']),
    disc: cards(['K-S']),
    held: null,
    from: null,
    botHeld: null,
    peek: [false, false, false, false],
    seen: [false, false, false, false],
    botPeek: [false, false, false, false],
    called: false,
    splash: false,
    learned: [],
    note: null,
  };
}

/** Points under the default rules: ace 1, faces 10, red kings 0. */
export function pointsOf(c: Pick<TCard, 'rank' | 'suit'>): number {
  if (c.rank === 'A') return 1;
  if (c.rank === 'K') return c.suit === 'H' || c.suit === 'D' ? 0 : 10;
  if (c.rank === 'J' || c.rank === 'Q') return 10;
  return Number(c.rank);
}

export const total = (hand: readonly (TCard | null)[]) => hand.reduce((t, c) => t + (c ? pointsOf(c) : 0), 0);
export const top = (s: Tut) => s.disc[s.disc.length - 1] ?? null;
/** The call is offered from your second turn, so a first-time visitor plays at least once. */
export const canCall = (s: Tut) => s.phase === 'turn' && s.turn >= 2;
/** The fixed deck runs short: only the call is left. */
export const deckLow = (s: Tut) => s.deck.length < 2;

const learn = (s: Tut, m: Move): Move[] => (s.learned.includes(m) ? s.learned : [...s.learned, m]);
const hidden = [false, false, false, false];

/** Which of your slots a touch can act on now. */
export function tappableMine(s: Tut): number[] {
  if (s.phase === 'peek') return [2, 3].filter((i) => !s.seen[i]);
  if (s.phase === 'drawn' || s.phase === 'powerOwn' || s.phase === 'quick')
    return s.you.flatMap((c, i) => (c ? [i] : []));
  return [];
}

export function step(s: Tut, a: TAction): Step {
  switch (a.t) {
    case 'restart':
      return { state: freshTut() };
    case 'hide':
      return {
        state: { ...s, peek: hidden, botPeek: hidden, phase: s.phase === 'wait' && !s.called ? 'turn' : s.phase },
      };
    case 'tapMine': {
      if (!tappableMine(s).includes(a.i)) return { state: s };
      const peek = s.peek.map((p, k) => p || k === a.i);
      const seen = s.seen.map((p, k) => p || k === a.i);
      if (s.phase === 'peek') {
        const next = { ...s, peek, seen, learned: learn(s, 'peek'), note: null };
        if (seen[2] && seen[3])
          return { state: { ...next, phase: 'wait' }, after: { ms: 2200, action: { t: 'hide' } } };
        return { state: next };
      }
      if (s.phase === 'drawn' && s.held) {
        const old = s.you[a.i] as TCard;
        const you = s.you.map((c, k) => (k === a.i ? s.held : c));
        return {
          state: {
            ...s,
            you,
            seen,
            held: null,
            disc: [...s.disc, old],
            phase: 'wait',
            learned: learn(s, 'swap'),
            note: { k: 'swapOut', card: old },
          },
          after: { ms: 900, action: { t: 'botTurn' } },
        };
      }
      if (s.phase === 'powerOwn')
        return {
          state: { ...s, peek, seen, phase: 'wait', learned: learn(s, 'power') },
          after: { ms: 1900, action: { t: 'botTurn' } },
        };
      if (s.phase === 'quick') {
        const card = s.you[a.i] as TCard;
        const t = top(s);
        if (t && card.rank === t.rank) {
          const you = s.you.map((c, k) => (k === a.i ? null : c));
          const unseen = s.seen.map((p, k) => p && k !== a.i);
          return {
            state: {
              ...s,
              you,
              seen: unseen,
              disc: [...s.disc, card],
              phase: 'wait',
              learned: learn(s, 'quick'),
              note: { k: 'quickHit' },
            },
            after: { ms: 700, action: { t: 'nextTurn' } },
          };
        }
        // A wrong claim costs a penalty card in the game; the tutorial forgives it and says so.
        return {
          state: { ...s, phase: 'wait', note: { k: 'quickMiss' } },
          after: { ms: 700, action: { t: 'nextTurn' } },
        };
      }
      return { state: s };
    }
    case 'tapBot':
      if (s.phase !== 'powerOther') return { state: s };
      return {
        state: { ...s, botPeek: s.botPeek.map((p, k) => p || k === a.i), phase: 'wait', learned: learn(s, 'power') },
        after: { ms: 1900, action: { t: 'botTurn' } },
      };
    case 'draw': {
      if (s.phase !== 'turn' || deckLow(s)) return { state: s };
      if (a.from === 'deck') {
        const [held, ...deck] = s.deck;
        return {
          state: {
            ...s,
            held: held ?? null,
            deck,
            from: 'deck',
            phase: 'drawn',
            learned: learn(s, 'draw'),
            note: null,
          },
        };
      }
      const held = top(s);
      if (!held) return { state: s };
      return {
        state: {
          ...s,
          held,
          disc: s.disc.slice(0, -1),
          from: 'disc',
          phase: 'drawn',
          learned: learn(s, 'draw'),
          note: null,
        },
      };
    }
    case 'discard': {
      if (s.phase !== 'drawn' || s.from !== 'deck' || !s.held) return { state: s };
      const r = s.held.rank;
      const next = { ...s, disc: [...s.disc, s.held], held: null, learned: learn(s, 'discard') };
      if (r === '7' || r === '8') return { state: { ...next, phase: 'powerOwn' } };
      if (r === '9' || r === '10') return { state: { ...next, phase: 'powerOther' } };
      return { state: { ...next, phase: 'wait' }, after: { ms: 700, action: { t: 'botTurn' } } };
    }
    case 'tamalou':
      if (!canCall(s)) return { state: s };
      return {
        state: { ...s, called: true, splash: true, phase: 'wait', learned: learn(s, 'tamalou'), note: null },
        after: { ms: 1500, action: { t: 'botTurn' } },
      };
    case 'letPass':
      return s.phase === 'quick' ? step(s, { t: 'nextTurn' }) : { state: s };
    case 'nextTurn':
      return { state: { ...s, turn: s.turn + 1, phase: 'turn' } };
    case 'botTurn': {
      const base = { ...s, splash: false, peek: hidden, botPeek: hidden };
      const [botHeld, ...deck] = s.deck;
      if (!botHeld) return { state: { ...base, phase: 'end' } };
      return { state: { ...base, botHeld, deck, phase: 'bot' }, after: { ms: 900, action: { t: 'botPlay' } } };
    }
    case 'botPlay': {
      const drawn = s.botHeld;
      if (!drawn) return { state: s };
      // Malo knows his own cards and keeps a low one in place of his worst.
      let worst = 0;
      s.bot.forEach((c, k) => {
        if (pointsOf(c) > pointsOf(s.bot[worst] as TCard)) worst = k;
      });
      const v = pointsOf(drawn);
      const old = s.bot[worst] as TCard;
      const keep = v <= 4 && v < pointsOf(old);
      return {
        state: keep
          ? {
              ...s,
              bot: s.bot.map((c, k) => (k === worst ? drawn : c)),
              disc: [...s.disc, old],
              botHeld: null,
              note: { k: 'botSwap', card: old },
            }
          : { ...s, disc: [...s.disc, drawn], botHeld: null, note: { k: 'botDiscard', card: drawn } },
        after: { ms: 1000, action: { t: 'botDone' } },
      };
    }
    case 'botDone': {
      if (s.called) return { state: { ...s, phase: 'end' } };
      const t = top(s);
      // A quick discard is offered when you know where a matching card is.
      const match = s.you.some((c, k) => c && s.seen[k] && t && c.rank === t.rank);
      return match ? { state: { ...s, phase: 'quick' } } : { state: { ...s, turn: s.turn + 1, phase: 'turn' } };
    }
  }
}
