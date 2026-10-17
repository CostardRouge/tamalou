import { parseRules } from '@tamalou/shared';
import { describe, expect, it } from 'vitest';
import { Handoff, type Scheduler, SPECTATOR, Table } from '../src/index.ts';

const clock = (): Scheduler & { advance(ms: number): void } => {
  let t = 0;
  const timers: { at: number; fn: () => void; id: number }[] = [];
  let seq = 0;
  return {
    now: () => t,
    setTimeout(fn, ms) {
      timers.push({ at: t + ms, fn, id: ++seq });
      return seq;
    },
    clearTimeout(h) {
      const i = timers.findIndex((x) => x.id === h);
      if (i >= 0) timers.splice(i, 1);
    },
    advance(ms) {
      const end = t + ms;
      for (;;) {
        timers.sort((a, b) => a.at - b.at);
        const next = timers[0];
        if (!next || next.at > end) break;
        timers.shift();
        t = next.at;
        next.fn();
      }
      t = end;
    },
  };
};

const passAndPlay = (bots = 0) => {
  const c = clock();
  const table = new Table({
    seed: 5,
    rules: parseRules({ quickDiscard: { enabled: false } }),
    scheduler: c,
    seats: [
      { id: 'ana', name: 'Ana', kind: 'human' },
      { id: 'ben', name: 'Ben', kind: 'human' },
      ...Array.from({ length: bots }, (_, i) => ({
        id: `b${i}`,
        name: `Bot ${i}`,
        kind: 'bot' as const,
        level: 'easy' as const,
      })),
    ],
  });
  return { table, c };
};

describe('pass-and-play handoff', () => {
  it('asks each human in turn for the initial peek, then the current player', () => {
    const { table } = passAndPlay();
    expect(table.humanToAct()).toBe('ana');
    table.submit({ type: 'ready', by: 'ana' });
    expect(table.humanToAct()).toBe('ben');
    table.submit({ type: 'ready', by: 'ben' });
    expect(table.humanToAct()).toBe('ana');
  });

  it('waits for nobody while a bot plays', () => {
    const { table, c } = passAndPlay(1);
    table.submit({ type: 'ready', by: 'ana' });
    table.submit({ type: 'ready', by: 'ben' });
    c.advance(5000);
    table.submit({ type: 'callTamalou', by: 'ana' });
    // Ben then the bot play their last turns.
    expect(table.humanToAct()).toBe('ben');
  });

  it('hides a view until the device is handed over, and shows the table in between', () => {
    const h = new Handoff();
    h.update('ana');
    expect(h).toMatchObject({ shown: null, pending: 'ana', viewer: SPECTATOR });
    h.reveal();
    expect(h).toMatchObject({ shown: 'ana', pending: null, viewer: 'ana' });
    h.update('ana');
    expect(h.shown).toBe('ana');
    h.update('ben');
    expect(h).toMatchObject({ shown: null, pending: 'ben', viewer: SPECTATOR });
    h.update(null);
    expect(h).toMatchObject({ shown: null, pending: null });
    h.reveal();
    expect(h.shown).toBeNull();
  });

  it('shows the spectator no private card, and keeps private events out of the shared log', () => {
    const { table } = passAndPlay();
    const v = table.view(SPECTATOR);
    expect(v.players.every((p) => p.slots.every((s) => s.card === null))).toBe(true);
    expect(table.view('ana').players[0]?.slots.filter((s) => s.card).length).toBe(2);
    expect(table.publicEvents().some((e) => 'to' in e)).toBe(false);
    expect(table.events('ana').some((e) => e.type === 'initialPeek')).toBe(true);
    expect(table.humans()).toEqual(['ana', 'ben']);
  });
});
