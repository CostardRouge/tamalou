// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Overlay } from '../src/game/Overlay.tsx';

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
