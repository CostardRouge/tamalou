import { createGame, viewFor } from '@tamalou/engine';
import { type Card, type PlayerView, parseRules } from '@tamalou/shared';
import { describe, expect, it } from 'vitest';
import { powerIfThrown, powerInPlay, powerMarks, powerOfCard } from '../src/game/power.ts';

const rules = parseRules();
const card = (rank: Card['rank']): Card => ({ id: 1, rank, suit: 'S', deck: 0 });

describe('powers made visible', () => {
  it('says what my drawn card gives if I throw it, as the engine reads the rules', () => {
    expect(powerIfThrown({ from: 'deck', card: card('9') }, rules)).toBe('peekOther');
    expect(powerIfThrown({ from: 'deck', card: card('Q') }, rules)).toBe('peekThenSwap');
    expect(powerIfThrown({ from: 'deck', card: card('5') }, rules)).toBeNull();
    // From the discard, only when the game master lets a power play from either pile.
    expect(powerIfThrown({ from: 'discard', card: card('J') }, rules)).toBeNull();
    expect(powerOfCard(card('J'), 'discard', parseRules({ powers: { activation: 'anyPile' } }))).toBe('blindSwap');
    expect(powerIfThrown(null, rules)).toBeNull();
    expect(powerIfThrown({ from: 'deck', card: null }, rules)).toBeNull();
  });

  it('finds the power being played, offered or showing its card, and who plays it', () => {
    const { state } = createGame({
      seed: 1,
      players: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      rules,
    });
    const view = viewFor(state, 'a', rules);
    expect(powerInPlay(view)).toBeNull();
    const playing = { ...view, phase: 'play', current: 'b' } as PlayerView;
    expect(powerInPlay({ ...playing, step: 'power', pendingPower: { player: 'b', power: 'peekOwn' } })).toEqual({
      player: 'b',
      power: 'peekOwn',
    });
    expect(
      powerInPlay({
        ...playing,
        step: 'reveal',
        reveal: { player: 'b', power: 'peekThenSwap', target: { player: 'a', slot: 0 }, card: null },
      }),
    ).toEqual({ player: 'b', power: 'peekThenSwap' });
    expect(powerInPlay({ ...playing, step: 'draw' })).toBeNull();
  });

  it('draws an eye for a look, arrows for a swap, both for the Queen', () => {
    expect(powerMarks('peekOwn')).toEqual(['look']);
    expect(powerMarks('blindSwap')).toEqual(['swap']);
    expect(powerMarks('peekThenSwap')).toEqual(['look', 'swap']);
  });
});
