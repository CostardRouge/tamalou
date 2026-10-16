import { type Action, parseRules, type RuleSetInput } from '@tamalou/shared';
import { describe, expect, it } from 'vitest';
import { type Scheduler, type SeatSpec, Table } from '../src/index.ts';

/** A clock moved by hand: timers fire in order when time is advanced. */
class FakeClock implements Scheduler {
  private t = 0;
  private seq = 0;
  private timers = new Map<number, { at: number; fn: () => void }>();
  now() {
    return this.t;
  }
  setTimeout(fn: () => void, ms: number) {
    const id = ++this.seq;
    this.timers.set(id, { at: this.t + ms, fn });
    return id;
  }
  clearTimeout(h: unknown) {
    this.timers.delete(h as number);
  }
  /** Runs every timer due within `ms`, in time order, including ones set while running. */
  advance(ms: number) {
    const end = this.t + ms;
    for (;;) {
      let next: [number, { at: number; fn: () => void }] | undefined;
      for (const e of this.timers) if (e[1].at <= end && (!next || e[1].at < next[1].at)) next = e;
      if (!next) break;
      this.timers.delete(next[0]);
      this.t = next[1].at;
      next[1].fn();
    }
    this.t = end;
  }
  pending() {
    return this.timers.size;
  }
}

const seats = (...levels: ('human' | 'easy' | 'medium' | 'hard')[]): SeatSpec[] =>
  levels.map((l, i) =>
    l === 'human'
      ? { id: `h${i}`, name: 'Moi', kind: 'human' }
      : { id: `b${i}`, name: `Bot ${i}`, kind: 'bot', level: l },
  );

const table = (spec: SeatSpec[], input: RuleSetInput = {}, seed = 3) => {
  const clock = new FakeClock();
  const t = new Table({ seed, rules: parseRules(input), seats: spec, scheduler: clock });
  return { t, clock };
};

describe('table host', () => {
  it('plays an all-bot game to the end on its own clock', () => {
    const { t, clock } = table(seats('hard', 'medium', 'easy'));
    for (let i = 0; i < 2000 && t.view('b0').phase !== 'gameOver'; i++) clock.advance(1000);
    expect(t.view('b0').phase).toBe('gameOver');
    expect(t.view('b0').winners?.length).toBeGreaterThan(0);
  });

  it('waits for the human, then lets the bots move after their delay', () => {
    const { t, clock } = table(seats('human', 'medium'));
    expect(t.view('h0').phase).toBe('initialPeek');
    clock.advance(5000);
    // The bot is ready, the human is not: still peeking.
    expect(t.view('h0').phase).toBe('initialPeek');
    expect(t.submit({ type: 'ready', by: 'h0' })).toEqual({ ok: true });
    expect(t.view('h0')).toMatchObject({ phase: 'play', current: 'h0', step: 'draw' });
  });

  it('refuses actions for a seat that is not a human one', () => {
    const { t } = table(seats('human', 'medium'));
    expect(t.submit({ type: 'ready', by: 'b1' })).toEqual({ ok: false, error: 'notYourSeat' });
    expect(t.submit({ type: 'draw', by: 'h0', from: 'deck' })).toEqual({ ok: false, error: 'wrongPhase' });
  });

  it('holds a draw back until the quick-discard window has run its minimum', () => {
    const { t, clock } = table(seats('human', 'medium'));
    clock.advance(5000);
    t.submit({ type: 'ready', by: 'h0' });
    // Play just started: the first face-up card opened the window.
    const r = t.submit({ type: 'draw', by: 'h0', from: 'deck' });
    expect(r).toEqual({ ok: true, deferred: true });
    expect(t.drawPending()).toBe(true);
    expect(t.view('h0').step).toBe('draw');
    clock.advance(t.windowRemaining());
    expect(t.view('h0').step).toBe('place');
    expect(t.drawPending()).toBe(false);
  });

  it('waits for no window when quick discard is off', () => {
    const { t, clock } = table(seats('human', 'medium'), { quickDiscard: { enabled: false } });
    clock.advance(5000);
    t.submit({ type: 'ready', by: 'h0' });
    expect(t.windowRemaining()).toBe(0);
    expect(t.submit({ type: 'draw', by: 'h0', from: 'deck' })).toEqual({ ok: true });
    expect(t.view('h0').step).toBe('place');
  });

  it('scores the round once its window has run, then deals when the human asks', () => {
    const { t, clock } = table(seats('human', 'easy'), { quickDiscard: { minWindowMs: 1000 } });
    t.submit({ type: 'ready', by: 'h0' });
    clock.advance(1500);
    expect(t.submit({ type: 'callTamalou', by: 'h0' })).toEqual({ ok: true });
    for (let i = 0; i < 50 && t.view('h0').phase !== 'roundOver'; i++) clock.advance(500);
    expect(t.view('h0').phase).toBe('roundOver');
    clock.advance(10_000);
    expect(t.view('h0').round).toBe(1);
    t.continue('h0');
    clock.advance(0);
    expect(t.view('h0')).toMatchObject({ round: 2, phase: 'initialPeek' });
  });

  it('plays a timed-out human turn with a stand-in bot', () => {
    const { t, clock } = table(seats('human', 'medium'), { pace: { turnTimerSeconds: 10 } });
    clock.advance(5000);
    t.submit({ type: 'ready', by: 'h0' });
    clock.advance(9000);
    expect(t.view('h0').current).toBe('h0');
    clock.advance(1500);
    expect(t.view('h0').current).not.toBe('h0');
  });

  it('lets a bot claim a quick discard after its reaction delay', () => {
    // Search a few seeds for a claim by a bot: hard bots claim whenever they remember a match.
    let claimed = false;
    for (let seed = 1; seed < 30 && !claimed; seed++) {
      const { t, clock } = table(seats('hard', 'hard'), {}, seed);
      for (let i = 0; i < 400 && !claimed && t.view('b0').phase !== 'gameOver'; i++) {
        clock.advance(400);
        claimed = t.events('b0').some((e) => e.type === 'quickDiscard');
      }
    }
    expect(claimed).toBe(true);
  });

  it('tells its listeners after every change, and stops on dispose', () => {
    const { t, clock } = table(seats('human', 'medium'));
    let calls = 0;
    const off = t.subscribe(() => calls++);
    t.submit({ type: 'ready', by: 'h0' });
    expect(calls).toBeGreaterThan(0);
    off();
    t.dispose();
    expect(t.submit({ type: 'draw', by: 'h0', from: 'deck' } as Action)).toEqual({ ok: false, error: 'disposed' });
    clock.advance(10_000);
    expect(clock.pending()).toBe(0);
  });
});
