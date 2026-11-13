import { createGame, viewFor } from '@tamalou/engine';
import { type PlayerView, parseRules, type RoundResult } from '@tamalou/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { roundHeadline, type Seats, seatLabel } from '../src/game/roundText.ts';
import { setLang } from '../src/i18n/index.ts';

afterEach(() => setLang('fr', false));

const rules = parseRules({});
const base = viewFor(
  createGame({
    seed: 3,
    players: [
      { id: 'me', name: 'Steeve' },
      { id: 'ada', name: 'Ada' },
    ],
    rules,
  }).state,
  'me',
  rules,
);

const ended = (result: Partial<RoundResult>, over?: { winners: string[] }): PlayerView => ({
  ...base,
  phase: over ? 'gameOver' : 'roundOver',
  winners: over?.winners ?? null,
  lastResult: { round: 2, caller: null, callerFailed: false, scores: [], eliminated: [], ...result },
});

const seats = (myName: string, shared = false): Seats => ({
  me: 'me',
  nameOf: (id) => (id === 'me' ? myName : 'Ada'),
  shared,
});

describe('the end-of-round panel', () => {
  it('speaks to the player who called Tamalou', () => {
    expect(roundHeadline(ended({ caller: 'me' }), seats('Steeve'))).toBe('Tu as réussi ton Tamalou.');
    expect(roundHeadline(ended({ caller: 'me', callerFailed: true }), seats('Steeve'))).toBe(
      'Tu as raté ton Tamalou : pénalité.',
    );
    expect(roundHeadline(ended({ caller: 'ada' }), seats('Steeve'))).toBe('Ada a réussi son Tamalou.');
    setLang('en', false);
    expect(roundHeadline(ended({ caller: 'me' }), seats('Steeve'))).toBe('You made your Tamalou.');
    expect(roundHeadline(ended({ caller: 'ada', callerFailed: true }), seats('Steeve'))).toBe(
      'Ada missed their Tamalou: penalty.',
    );
  });

  it('shows the player by name with "(toi)", or "Toi" when no name was typed', () => {
    expect(seatLabel('me', seats('Steeve'))).toEqual({ name: 'Steeve', you: true });
    expect(seatLabel('ada', seats('Steeve'))).toEqual({ name: 'Ada', you: false });
    expect(seatLabel('me', seats('Moi'))).toEqual({ name: 'Toi', you: false });
    setLang('en', false);
    expect(seatLabel('me', seats('Me'))).toEqual({ name: 'You', you: false });
    // A game named in French, then read in English.
    expect(seatLabel('me', seats('Moi'))).toEqual({ name: 'You', you: false });
  });

  it('names everyone in the third person on a shared device', () => {
    const shared = seats('Ana', true);
    expect(seatLabel('me', shared)).toEqual({ name: 'Ana', you: false });
    expect(roundHeadline(ended({ caller: 'me' }), shared)).toBe('Ana a réussi son Tamalou.');
    expect(roundHeadline(ended({}, { winners: ['me'] }), shared)).toBe('Ana gagne !');
  });

  it('names the winners of the game the same way', () => {
    expect(roundHeadline(ended({}, { winners: ['me'] }), seats('Steeve'))).toBe('Tu gagnes !');
    expect(roundHeadline(ended({}, { winners: ['me', 'ada'] }), seats('Steeve'))).toBe(
      'Victoire partagée : Steeve (toi), Ada',
    );
    expect(roundHeadline(ended({}, { winners: ['me', 'ada'] }), seats('Moi'))).toBe('Victoire partagée : Toi, Ada');
    expect(roundHeadline(ended({ caller: null }), seats('Steeve'))).toBe('Personne n’a annoncé Tamalou.');
  });
});
