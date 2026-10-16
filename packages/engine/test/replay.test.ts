import { cardLabel, parseRules } from '@tamalou/shared';
import { describe, expect, it } from 'vitest';
import { nextRandom, ReplayError, replay, seedFrom } from '../src/index.ts';

const players = [
  { id: 'a', name: 'A' },
  { id: 'b', name: 'B' },
];

describe('replay', () => {
  it('stops on a refused action and says which', () => {
    const rules = parseRules();
    const record = {
      seed: 9,
      players,
      rules,
      actions: [{ type: 'ready', by: 'a' } as const, { type: 'ready', by: 'a' } as const],
    };
    expect(() => replay(record)).toThrow(ReplayError);
    try {
      replay(record);
    } catch (e) {
      expect(e).toMatchObject({ index: 1, code: 'alreadyReady' });
    }
  });
});

describe('randomness', () => {
  it('turns any text into a stable 32-bit seed', () => {
    expect(seedFrom('tamalou')).toBe(seedFrom('tamalou'));
    expect(seedFrom('tamalou')).not.toBe(seedFrom('Tamalou'));
    expect(seedFrom('')).toBeGreaterThanOrEqual(0);
  });

  it('is a pure function of its state', () => {
    const [a, s1] = nextRandom(42);
    const [b] = nextRandom(42);
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
    expect(nextRandom(s1)[0]).not.toBe(a);
  });
});

describe('card labels', () => {
  it('name a card in French', () => {
    expect(cardLabel({ rank: 'Q', suit: 'H' })).toBe('Dame de cœur');
    expect(cardLabel({ rank: '10', suit: 'S' })).toBe('10 de pique');
    expect(cardLabel({ rank: 'JOKER', suit: null })).toBe('Joker');
  });
});
