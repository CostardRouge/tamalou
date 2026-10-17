import { createGame, viewFor } from '@tamalou/engine';
import { parseRules } from '@tamalou/shared';
import { describe, expect, it } from 'vitest';
import { confirmQuestion } from '../src/game/confirm.ts';

const rules = parseRules({ hand: { initialPeek: { count: 0 } } });
const view = viewFor(
  createGame({
    seed: 3,
    players: [
      { id: 'me', name: 'Moi' },
      { id: 'ada', name: 'Ada' },
    ],
    rules,
  }).state,
  'me',
  rules,
);
const nameOf = (id: string) => (id === 'ada' ? 'Ada' : 'Moi');

describe('the confirmation of a move', () => {
  it('asks before the moves a touch on a card sends, and before Tamalou', () => {
    expect(confirmQuestion({ type: 'swap', by: 'me', slot: 0 }, view, nameOf)).toBe(
      'Remplacer ta carte 1 par la carte piochée ?',
    );
    expect(confirmQuestion({ type: 'usePower', by: 'me', targets: [{ player: 'ada', slot: 2 }] }, view, nameOf)).toBe(
      'Regarder la carte 3 de Ada ?',
    );
    expect(
      confirmQuestion(
        {
          type: 'usePower',
          by: 'me',
          targets: [
            { player: 'me', slot: 1 },
            { player: 'ada', slot: 0 },
          ],
        },
        view,
        nameOf,
      ),
    ).toBe('Échanger ta carte 2 avec la carte 1 de Ada, sans les regarder ?');
    expect(
      confirmQuestion(
        { type: 'quickDiscard', by: 'me', target: { player: 'me', slot: 3 }, expectTop: 0 },
        view,
        nameOf,
      ),
    ).toBe('Poser ta carte 4 sur la défausse ?');
    expect(confirmQuestion({ type: 'callTamalou', by: 'me' }, view, nameOf)).toContain('Tamalou');
  });

  it('lets the buttons that name their move go at once', () => {
    expect(confirmQuestion({ type: 'draw', by: 'me', from: 'deck' }, view, nameOf)).toBeNull();
    expect(confirmQuestion({ type: 'discardDrawn', by: 'me' }, view, nameOf)).toBeNull();
    expect(confirmQuestion({ type: 'skipPower', by: 'me' }, view, nameOf)).toBeNull();
    expect(confirmQuestion({ type: 'queenDecide', by: 'me', swapWith: null }, view, nameOf)).toBeNull();
  });
});
