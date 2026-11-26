// @vitest-environment jsdom

import type { PlayerView } from '@tamalou/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameConnection } from '../src/connection/types.ts';
import { Overlay } from '../src/game/Overlay.tsx';
import { RoundOver } from '../src/game/RoundOver.tsx';

afterEach(cleanup);

describe('a panel over the table', () => {
  it('closes on a tap beside the panel or on Escape, never on a tap inside it', () => {
    const onClose = vi.fn();
    render(
      <Overlay labelledBy="t" onClose={onClose}>
        <div className="panel">
          <h2 id="t">Affichage</h2>
          <button type="button">Dedans</button>
        </div>
      </Overlay>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Dedans' }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
    // Escape works whatever is focused: the mode's panel focuses nothing when it opens.
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('stays when it has no way to close: the end of a round is left by its buttons', () => {
    render(
      <Overlay labelledBy="r">
        <div className="panel">
          <h2 id="r">Fin de manche</h2>
        </div>
      </Overlay>,
    );
    fireEvent.click(screen.getByRole('dialog'));
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});

describe('the end of a round', () => {
  it('always has a way out, even while waiting for the others (the owner’s report, 2026-11-26)', () => {
    const view = {
      phase: 'roundOver',
      me: 'you',
      players: [{ id: 'you', name: 'Moi', total: 3, slots: [] }],
      lastResult: {
        round: 3,
        caller: null,
        callerFailed: false,
        scores: [{ player: 'you', hand: 0, scored: 0, total: 3 }],
        eliminated: [],
      },
    } as unknown as PlayerView;
    const conn = { readyForNext: () => ['you'], events: () => [] } as unknown as GameConnection;
    const onLeave = vi.fn();
    render(<RoundOver view={view} conn={conn} nameOf={(id) => id} onQuit={() => {}} onLeave={onLeave} />);
    expect(screen.getByText('En attente des autres joueurs…')).toBeTruthy();
    // A hand with no card left keeps a card's place, so its row is as tall as the others.
    expect(screen.getByRole('img', { name: 'Plus aucune carte' }).className).toContain('card-empty');
    fireEvent.click(screen.getByRole('button', { name: 'Quitter la partie' }));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });
});
