import type { Card, GameEvent } from '@tamalou/shared';
import { describe, expect, it } from 'vitest';
import { cueOf, strongestCue, touchedSlots } from '../src/feedback/cues.ts';
import { getSettings, updateSettings } from '../src/feedback/settings.ts';

const card: Card = { id: 1, rank: '7', suit: 'H', deck: 0 };

describe('cues', () => {
  it('rings for my turn only, and keeps vibrations for what is about me', () => {
    expect(cueOf({ type: 'turnStarted', player: 'me' }, 'me')).toEqual({ cue: 'yourTurn', mine: true });
    expect(cueOf({ type: 'turnStarted', player: 'ada' }, 'me')).toBeNull();
    const failed: GameEvent = {
      type: 'quickDiscardFailed',
      player: 'ada',
      target: { player: 'ada', slot: 0 },
      card,
      penalty: [],
    };
    expect(cueOf(failed, 'me')).toEqual({ cue: 'fail', mine: false });
    expect(cueOf({ type: 'gameEnded', winners: ['me'], totals: [] }, 'me')?.cue).toBe('win');
    expect(cueOf({ type: 'gameEnded', winners: ['ada'], totals: [] }, 'me')?.cue).toBe('round');
    expect(cueOf({ type: 'playerReady', player: 'me' }, 'me')).toBeNull();
  });

  it('plays the strongest cue of a batch, and flashes the slots a move touched', () => {
    const batch: GameEvent[] = [
      { type: 'drew', player: 'ada', from: 'deck' },
      { type: 'swapped', player: 'ada', slot: 2, discarded: card },
      { type: 'tamalouCalled', player: 'ada' },
      { type: 'turnStarted', player: 'me' },
    ];
    expect(strongestCue(batch, 'me')?.cue).toBe('tamalou');
    expect(strongestCue([], 'me')).toBeNull();
    expect(
      touchedSlots([
        ...batch,
        {
          type: 'cardsSwapped',
          player: 'me',
          a: { player: 'me', slot: 0 },
          b: { player: 'ada', slot: 1 },
          power: 'blindSwap',
        },
        { type: 'quickDiscard', player: 'me', target: { player: 'me', slot: 3 }, card },
        { type: 'powerUsed', player: 'me', power: 'peekOther', targets: [{ player: 'ada', slot: 0 }] },
      ]),
    ).toEqual(['ada:2', 'me:0', 'ada:1', 'me:3', 'ada:0']);
  });
});

describe('settings', () => {
  it('start with sounds and vibrations on, and change one at a time', () => {
    expect(getSettings()).toEqual({ sound: true, haptics: true });
    updateSettings({ sound: false });
    expect(getSettings()).toEqual({ sound: false, haptics: true });
    updateSettings({ sound: true });
  });
});
