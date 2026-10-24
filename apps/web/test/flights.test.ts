import type { Card, GameEvent } from '@tamalou/shared';
import { describe, expect, it } from 'vitest';
import { bubblesOf, DEAL_STEP, dealToReplay, flightsOf } from '../src/game/flights.ts';

const c = (rank: Card['rank'], suit: Card['suit'] = 'S', id = 1): Card => ({ id, rank, suit, deck: 0 });

describe('the flights of a move', () => {
  it('deals one card at a time round the table from the starter, then turns the discard’s first card over', () => {
    const start: GameEvent = {
      type: 'roundStarted',
      round: 1,
      starter: 'ada',
      players: ['me', 'ada'],
      discardTop: c('K'),
    };
    const deal = flightsOf([start], 'me', (p) => (p === 'me' ? 4 : 3));
    expect(deal.slice(0, 3).map((f) => [f.to, f.beat])).toEqual([
      ['slot:ada:0', 0],
      ['slot:me:0', DEAL_STEP],
      ['slot:ada:1', 2 * DEAL_STEP],
    ]);
    expect(deal.filter((f) => f.to.startsWith('slot:'))).toHaveLength(7);
    expect(deal.every((f) => f.from === 'deck' && f.dealt)).toBe(true);
    expect(deal.at(-1)).toMatchObject({ to: 'discard', card: c('K'), turnsOver: true });
  });

  it('replays the deal when a table opens on a round nobody has played yet, and only then', () => {
    const start: GameEvent = { type: 'roundStarted', round: 1, starter: 'me', players: ['me'], discardTop: c('K') };
    const peek: GameEvent = { type: 'initialPeek', to: 'me', cards: [] };
    expect(dealToReplay([start, peek, { type: 'playerReady', player: 'me' }])).toBe(0);
    expect(dealToReplay([start, { type: 'playStarted', current: 'me' }])).toBeUndefined();
    expect(dealToReplay([])).toBeUndefined();
  });

  it('flies a swap in, then the old card out to the discard, turning over on the way', () => {
    const events: GameEvent[] = [
      { type: 'drew', player: 'ada', from: 'deck' },
      { type: 'swapped', player: 'ada', slot: 2, discarded: c('Q', 'C') },
    ];
    expect(flightsOf(events, 'me')).toEqual([
      { from: 'deck', to: 'drawn', card: null, beat: 0 },
      { from: 'drawn', to: 'slot:ada:2', card: null, beat: 1 },
      { from: 'slot:ada:2', to: 'discard', card: c('Q', 'C'), turnsOver: true, beat: 2 },
    ]);
  });

  it('shows my own drawn card face up, never another player’s', () => {
    const mine: GameEvent[] = [
      { type: 'drew', player: 'me', from: 'deck' },
      { type: 'drewCard', to: 'me', card: c('7', 'C') },
    ];
    expect(flightsOf(mine, 'me')[0]?.card).toEqual(c('7', 'C'));
    expect(flightsOf([{ type: 'drew', player: 'ada', from: 'deck' }], 'me')[0]?.card).toBeNull();
  });

  it('throws a quick discard and crosses the cards of a blind swap', () => {
    const quick = flightsOf(
      [{ type: 'quickDiscard', player: 'ada', target: { player: 'ada', slot: 1 }, card: c('6', 'H') }],
      'me',
    );
    expect(quick).toEqual([
      { from: 'slot:ada:1', to: 'discard', card: c('6', 'H'), turnsOver: true, thrown: true, beat: 0 },
    ]);
    const swap = flightsOf(
      [
        {
          type: 'cardsSwapped',
          player: 'ada',
          a: { player: 'ada', slot: 3 },
          b: { player: 'me', slot: 1 },
          power: 'blindSwap',
        },
      ],
      'me',
    );
    expect(swap.map((f) => `${f.from}>${f.to}`)).toEqual(['slot:ada:3>slot:me:1', 'slot:me:1>slot:ada:3']);
  });
});

describe('what the others say', () => {
  it('keeps one line per player, the last move, and never speaks for me', () => {
    const said = bubblesOf(
      [
        { type: 'drew', player: 'ada', from: 'deck' },
        { type: 'discarded', player: 'ada', card: c('7', 'D') },
        { type: 'drew', player: 'me', from: 'deck' },
        { type: 'powerUsed', player: 'bob', power: 'peekOther', targets: [{ player: 'me', slot: 0 }] },
      ],
      'me',
    );
    expect(said).toEqual([
      { player: 'ada', key: 'bubbleThrow', card: c('7', 'D') },
      { player: 'bob', key: 'bubblePeekYou' },
    ]);
  });
});
