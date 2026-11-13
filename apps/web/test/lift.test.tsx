// @vitest-environment jsdom
import type { Scheduler } from '@tamalou/room';
import { rulesFromPreset } from '@tamalou/shared';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HUMAN_ID, LocalConnection } from '../src/connection/local.ts';
import { GameScreen } from '../src/game/GameScreen.tsx';

// A touch lifts a card and sends nothing until it is put down (the owner, 2026-11-13): the discard before my draw,
// the card I drew. A touch beside it, or on it again, puts it back.

afterEach(cleanup);

/** A clock moved by hand: the bot plays only when the test says so. */
class Clock implements Scheduler {
  private t = 0;
  private timers = new Map<number, { at: number; fn: () => void }>();
  private seq = 0;
  now() {
    return this.t;
  }
  setTimeout(fn: () => void, ms: number) {
    this.timers.set(++this.seq, { at: this.t + ms, fn });
    return this.seq;
  }
  clearTimeout(h: unknown) {
    this.timers.delete(h as number);
  }
  advance(ms: number) {
    const end = this.t + ms;
    for (;;) {
      const next = [...this.timers].filter(([, x]) => x.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      this.timers.delete(next[0]);
      this.t = next[1].at;
      next[1].fn();
    }
    this.t = end;
  }
}

/** A game where it is my turn to draw, with a card on the discard. */
function myTurnToDraw() {
  const rules = rulesFromPreset('classic');
  for (let seed = 1; seed < 500; seed++) {
    const clock = new Clock();
    const conn = new LocalConnection({ humans: ['Moi'], bots: [{ name: 'Ada', level: 'easy' }], rules, seed }, clock);
    conn.send({ type: 'ready', by: HUMAN_ID });
    clock.advance(5000);
    const view = conn.view();
    if (view.phase === 'play' && view.current === HUMAN_ID && view.step === 'draw' && view.discardTop) return conn;
  }
  throw new Error('no seed lets me draw first');
}

const discard = () => screen.getByRole('button', { name: /^Défausse : / });
const myCard = (n: number) => screen.getByRole('button', { name: new RegExp(`^Ta carte ${n},`) });
const prompt = (text: string) => screen.getByText(text);

describe('a touch lifts a card before it is played', () => {
  it('lifts the discard without taking it, and a touch beside it puts it back', () => {
    const conn = myTurnToDraw();
    const top = conn.view().discardTop?.id;
    const { container } = render(<GameScreen conn={conn} onQuit={() => {}} />);
    fireEvent.click(discard());
    expect(conn.view().step).toBe('draw');
    expect(conn.view().drawn).toBeNull();
    prompt('Pose-la sur une de tes cartes. Touche à côté pour la reposer.');
    expect(screen.getByRole('button', { name: 'Reposer la carte' })).toBeTruthy();

    fireEvent.click(container.querySelector('.center') as Element);
    expect(screen.queryByText('Pose-la sur une de tes cartes. Touche à côté pour la reposer.')).toBeNull();
    expect(conn.view().step).toBe('draw');
    expect(conn.view().discardTop?.id).toBe(top);

    // The bar's "Prendre la défausse" lifts it the same way, and its "Reposer" puts it back.
    fireEvent.click(screen.getByRole('button', { name: 'Prendre la défausse' }));
    expect(conn.view().drawn).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reposer la carte' }));
    expect(screen.getByRole('button', { name: 'Prendre la défausse' })).toBeTruthy();
    expect(conn.view().step).toBe('draw');
  });

  it('takes the discard and swaps it in one gesture once it is put on one of my cards', () => {
    const conn = myTurnToDraw();
    const top = conn.view().discardTop;
    render(<GameScreen conn={conn} onQuit={() => {}} />);
    fireEvent.click(discard());
    fireEvent.click(myCard(2));
    const view = conn.view();
    expect(view.drawn).toBeNull();
    expect(view.step).not.toBe('place');
    expect(view.discardTop?.id).not.toBe(top?.id);
    expect(conn.events().some((e) => e.type === 'swapped' && e.player === HUMAN_ID && e.slot === 1)).toBe(true);
  });

  it('lifts the card I drew, puts it back, and throws it from there', () => {
    const conn = myTurnToDraw();
    render(<GameScreen conn={conn} onQuit={() => {}} />);
    act(() => {
      conn.send({ type: 'draw', by: HUMAN_ID, from: 'deck' });
    });
    const drawn = () => screen.getByRole('button', { name: /^Carte piochée/ });
    fireEvent.click(drawn());
    prompt('Pose-la sur une de tes cartes ou sur la défausse. Touche à côté pour la reposer.');
    fireEvent.click(drawn());
    prompt('Échange-la avec une de tes cartes, ou défausse-la.');
    expect(conn.view().step).toBe('place');

    const card = conn.view().drawn?.card?.id;
    fireEvent.click(drawn());
    fireEvent.click(discard());
    expect(conn.view().drawn).toBeNull();
    expect(conn.view().discardTop?.id).toBe(card);
  });
});
