import { buildCards, createGame, viewFor } from '@tamalou/engine';
import { type Card, type GameEvent, parseRules, type RuleSetInput } from '@tamalou/shared';
import { describe, expect, it } from 'vitest';
import { BOT_LEVELS, Bot, type BotLevel, BotMemory, PROFILES, playMatch, tournament } from '../src/index.ts';

const rules = parseRules();
const cards = buildCards(rules);
const card = (rank: string, suit: string): Card => {
  const c = cards.find((x) => x.rank === rank && x.suit === suit);
  if (!c) throw new Error(`${rank}${suit}`);
  return c;
};
const perfect = () => new BotMemory('a', rules, { retain: 1, forget: 0 }, () => 0.5);

describe('bot memory', () => {
  it('notes what it is shown, and nothing it is not', () => {
    const m = perfect();
    m.observe([
      { type: 'roundStarted', round: 1, starter: 'a', players: ['a', 'b'], discardTop: card('9', 'C') },
      {
        type: 'initialPeek',
        to: 'a',
        cards: [
          { slot: 2, card: card('3', 'H') },
          { slot: 3, card: card('K', 'D') },
        ],
      },
    ]);
    expect(m.at({ player: 'a', slot: 2 })?.rank).toBe('3');
    expect(m.at({ player: 'a', slot: 0 })).toBeNull();
    // b draws from the pile and swaps: the slot's card is unknown, the old one is public.
    m.observe([
      { type: 'drew', player: 'b', from: 'deck' },
      { type: 'swapped', player: 'b', slot: 1, discarded: card('Q', 'S') },
    ]);
    expect(m.at({ player: 'b', slot: 1 })).toBeNull();
    // a takes the queen from the discard: everyone knows where it went.
    m.observe([
      { type: 'drew', player: 'a', from: 'discard', card: card('Q', 'S') },
      { type: 'swapped', player: 'a', slot: 0, discarded: card('7', 'S') },
    ]);
    expect(m.at({ player: 'a', slot: 0 })?.rank).toBe('Q');
  });

  it('follows cards through swaps, quick discards and reshuffles', () => {
    const m = perfect();
    const ev: GameEvent[] = [
      { type: 'roundStarted', round: 1, starter: 'a', players: ['a', 'b'], discardTop: card('9', 'C') },
      { type: 'peeked', to: 'a', target: { player: 'b', slot: 0 }, card: card('2', 'S') },
      { type: 'initialPeek', to: 'a', cards: [{ slot: 3, card: card('J', 'H') }] },
      {
        type: 'cardsSwapped',
        player: 'a',
        a: { player: 'a', slot: 3 },
        b: { player: 'b', slot: 0 },
        power: 'blindSwap',
      },
    ];
    m.observe(ev);
    expect(m.at({ player: 'a', slot: 3 })?.rank).toBe('2');
    expect(m.at({ player: 'b', slot: 0 })?.rank).toBe('J');
    m.observe([{ type: 'quickDiscard', player: 'a', target: { player: 'b', slot: 0 }, card: card('J', 'H'), give: 3 }]);
    expect(m.at({ player: 'b', slot: 0 })?.rank).toBe('2');
    expect(m.at({ player: 'a', slot: 3 })).toBeNull();
    m.observe([
      { type: 'quickDiscardFailed', player: 'b', target: { player: 'b', slot: 1 }, card: card('5', 'D'), penalty: [4] },
    ]);
    expect(m.at({ player: 'b', slot: 1 })?.rank).toBe('5');
    const before = m.unknownMean();
    m.observe([{ type: 'deckReshuffled', size: 2 }]);
    // The discard pile went back into the unknown: the estimate moves.
    expect(m.unknownMean()).not.toBe(before);
  });

  it('estimates an unseen card at the mean of the cards it cannot place', () => {
    const m = perfect();
    m.observe([{ type: 'roundStarted', round: 1, starter: 'a', players: ['a', 'b'], discardTop: card('K', 'S') }]);
    const all = cards.reduce((s, c) => s + m.value(c), 0);
    expect(m.unknownMean()).toBeCloseTo((all - 10) / 51, 5);
  });

  it('forgets, at the medium level', () => {
    const m = new BotMemory('a', rules, { retain: 1, forget: 1 }, () => 0);
    m.observe([{ type: 'initialPeek', to: 'a', cards: [{ slot: 2, card: card('3', 'H') }] }]);
    m.tick();
    expect(m.at({ player: 'a', slot: 2 })).toBeNull();
    const skippy = new BotMemory('a', rules, { retain: 0, forget: 0 }, () => 0.5);
    skippy.observe([{ type: 'initialPeek', to: 'a', cards: [{ slot: 2, card: card('3', 'H') }] }]);
    expect(skippy.at({ player: 'a', slot: 2 })).toBeNull();
  });
});

describe('bots', () => {
  const variants: RuleSetInput[] = [
    {},
    { quickDiscard: { allowOpponentCards: true }, deck: { jokers: true } },
    { tamalou: { timing: 'endOfTurn', minTurnsBeforeCall: 2 }, hand: { initialPeek: { mode: 'choose' } } },
    { hand: { size: 6, columns: 3 }, powers: { activation: 'anyPile' }, discardPickup: { mustSwap: false } },
    { quickDiscard: { enabled: false }, gameEnd: { mode: 'rounds', rounds: 3 } },
  ];

  it('only ever send legal moves, and finish every game, at every level and table size', () => {
    let n = 0;
    for (const [v, input] of variants.entries()) {
      const r = parseRules(input);
      for (let players = 2; players <= 6; players += 2) {
        const levels = Array.from({ length: players }, (_, i) => BOT_LEVELS[(i + v) % 3] as BotLevel);
        // playMatch throws on a refused move.
        const res = playMatch({ seed: 50 + n++, rules: r, levels });
        expect(res.outcome).toBe('finished');
        expect(res.winners.length).toBeGreaterThan(0);
      }
    }
  });

  it('decide from their own view only: a bot never acts for another seat', () => {
    const { state } = createGame({
      seed: 4,
      players: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      rules,
    });
    const bot = new Bot('b', 'hard', rules, 1);
    const move = bot.decide(viewFor(state, 'b', rules));
    expect(move).toMatchObject({ by: 'b' });
  });

  it('ranks the levels: hard clearly beats easy, and medium sits between', () => {
    const duel = (a: 'hard' | 'medium', b: 'medium' | 'easy') => {
      const { byLevel, problems } = tournament({ games: 80, rules, levels: [a, b], seed: 7 });
      expect(problems).toEqual([]);
      const rate = (l: string) => (byLevel.find((x) => x.level === l)?.wins ?? 0) / 80;
      return rate(a);
    };
    expect(duel('hard', 'easy')).toBeGreaterThan(0.9);
    expect(duel('medium', 'easy')).toBeGreaterThan(0.9);
    expect(duel('hard', 'medium')).toBeGreaterThan(0.55);
  }, 60_000);

  it('give the host a thinking delay per level, faster as they get better', () => {
    expect(PROFILES.hard.delays.quickDiscard[0]).toBeLessThan(PROFILES.medium.delays.quickDiscard[0]);
    for (const p of Object.values(PROFILES)) expect(p.delays.turn[0]).toBeLessThanOrEqual(p.delays.turn[1]);
  });
});
