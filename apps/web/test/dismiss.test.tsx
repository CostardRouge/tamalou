// @vitest-environment jsdom
import { legalActions } from '@tamalou/engine';
import type { Scheduler } from '@tamalou/room';
import { rulesFromPreset } from '@tamalou/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HUMAN_ID, LocalConnection } from '../src/connection/local.ts';
import { GameScreen } from '../src/game/GameScreen.tsx';

afterEach(cleanup);

/** A clock moved by hand, so the bot readies itself and nothing else happens behind the test's back. */
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

/** A game where I start, draw a 7 and throw it: its power waits for me (`look`: I used it, it shows me a card). */
function lookingAtMyCard(look = true) {
  const rules = rulesFromPreset('classic');
  for (let seed = 1; seed < 500; seed++) {
    const clock = new Clock();
    const conn = new LocalConnection({ humans: ['Moi'], bots: [{ name: 'Ada', level: 'easy' }], rules, seed }, clock);
    conn.send({ type: 'ready', by: HUMAN_ID });
    clock.advance(5000);
    let view = conn.view();
    if (view.phase !== 'play' || view.current !== HUMAN_ID) continue;
    clock.advance(5000);
    conn.send({ type: 'draw', by: HUMAN_ID, from: 'deck' });
    if (conn.view().drawn?.card?.rank !== '7') continue;
    conn.send({ type: 'discardDrawn', by: HUMAN_ID });
    if (!look) return conn;
    view = conn.view();
    const peek = legalActions(view, rules).find((a) => a.type === 'usePower');
    if (!peek) continue;
    conn.send(peek);
    if (conn.view().step === 'reveal') return conn;
  }
  throw new Error('no seed shows me a card');
}

describe('a tap on nothing', () => {
  it('closes the card a power shows me, as "J’ai vu" does', () => {
    const conn = lookingAtMyCard();
    const { container } = render(<GameScreen conn={conn} onQuit={() => {}} />);
    expect(container.querySelector('.reveal-stage')).toBeTruthy();
    fireEvent.click(container.querySelector('.center') as Element);
    expect(conn.view().step).not.toBe('reveal');
    expect(container.querySelector('.reveal-stage')).toBeNull();
  });

  it('leaves a tap on a button alone', () => {
    const conn = lookingAtMyCard();
    render(<GameScreen conn={conn} onQuit={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Journal' }));
    expect(conn.view().step).toBe('reveal');
  });

  it('lets my power go when I throw a card on the one I just threw', () => {
    const conn = lookingAtMyCard(false);
    expect(conn.view().step).toBe('power');
    render(<GameScreen conn={conn} onQuit={() => {}} />);
    // The bolt, then one of my cards: the power is let go, then the quick discard is made.
    fireEvent.click(screen.getByRole('button', { name: /Défausse rapide/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Ta carte 1/ }));
    const types = conn.events().map((e) => e.type);
    expect(types).toContain('powerSkipped');
    expect(types.some((t) => t === 'quickDiscard' || t === 'quickDiscardFailed')).toBe(true);
  });
});
