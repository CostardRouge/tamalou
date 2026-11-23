import { describe, expect, it } from 'vitest';
import {
  MAX_USAGE_REPORT,
  parseUsageReport,
  summarizeUsage,
  type UsageContext,
  type UsageEvent,
  type UsageRow,
  usageCutoff,
  usageDay,
} from '../src/index.ts';

const ctx: UsageContext = {
  lang: 'fr',
  device: 'phone',
  orientation: 'portrait',
  connection: '4g',
  installed: false,
  sound: true,
  haptics: true,
  hand: 'row',
  drawView: 'held',
  botPace: 'normal',
  cardSpeed: 'normal',
};
const row = (day: string, event: UsageEvent, over: Partial<UsageContext> = {}): UsageRow => ({
  day,
  report: { v: 1, event, ctx: { ...ctx, ...over } },
});
const solo: UsageEvent = {
  kind: 'gameStarted',
  mode: 'solo',
  players: 4,
  humans: 1,
  bots: 3,
  level: 'hard',
  preset: 'classic',
  rulesChanged: false,
};

describe('usage statistics', () => {
  it('reads a report and refuses anything else, a name or a room code included', () => {
    const report = { v: 1, event: solo, ctx };
    expect(parseUsageReport(report)).toEqual(report);
    expect(parseUsageReport({ ...report, v: 2 })).toBeNull();
    expect(parseUsageReport({ ...report, ctx: { ...ctx, hand: 'Steeve <b>' } })).toBeNull();
    expect(parseUsageReport({ ...report, event: { kind: 'roomJoined', via: 'qr', code: 'ABCDE' } })).toEqual({
      ...report,
      event: { kind: 'roomJoined', via: 'qr' },
    });
    expect(parseUsageReport({ ...report, event: { ...solo, players: 11 } })).toBeNull();
    expect(JSON.stringify(report).length).toBeLessThan(MAX_USAGE_REPORT);
  });

  it('counts the days back from today, keeps 13 months', () => {
    expect(usageDay(new Date('2026-11-22T23:59:00Z'))).toBe('2026-11-22');
    expect(usageCutoff('2026-11-22', 2)).toBe('2026-11-20');
    expect(usageCutoff('2026-03-01', 1)).toBe('2026-02-28');
    expect(usageCutoff('2026-11-22')).toBe('2025-10-22');
  });

  it('sums up a period: games, modes, opponents, ways in, devices', () => {
    const rows: UsageRow[] = [
      row('2026-11-20', solo),
      row('2026-11-21', { ...solo, mode: 'pass', humans: 3, bots: 1, players: 4, level: 'easy' }, { sound: false }),
      row('2026-11-21', { ...solo, mode: 'online', humans: 2, bots: 0, players: 2, level: null, rulesChanged: true }),
      row('2026-11-22', { kind: 'gameEnded', mode: 'solo', players: 4, rounds: 5, minutes: 12, won: true }),
      row('2026-11-22', { kind: 'gameEnded', mode: 'pass', players: 4, rounds: 3, minutes: 6, won: null }),
      row('2026-11-22', { kind: 'gameEnded', mode: 'online', players: 2, rounds: 4, minutes: 9, won: false }),
      row('2026-11-22', { kind: 'roomCreated' }, { orientation: 'landscape', device: 'desktop' }),
      row('2026-11-22', { kind: 'roomJoined', via: 'qr' }),
      row('2026-11-22', { kind: 'roomJoined', via: 'qr' }),
      row('2026-11-22', { kind: 'roomJoined', via: 'link' }),
      // Outside the period: left out.
      row('2026-10-01', solo),
    ];
    const s = summarizeUsage(rows, '2026-11-22', 7);
    expect(s.days).toHaveLength(7);
    expect(s.days.at(-1)).toEqual({ day: '2026-11-22', started: 0, ended: 3, rooms: 1, joins: 3 });
    expect(s.days[0]?.day).toBe('2026-11-16');
    expect(s.totals).toEqual({ started: 3, ended: 3, rooms: 1, joins: 3 });
    expect(s.modes.map((t) => t.value).sort()).toEqual(['online', 'pass', 'solo']);
    expect(s.opponents).toEqual([
      { value: 'bots', count: 1 },
      { value: 'humans', count: 1 },
      { value: 'mixed', count: 1 },
    ]);
    expect(s.levels).toEqual([
      { value: 'easy', count: 1 },
      { value: 'hard', count: 1 },
    ]);
    expect(s.players[0]).toEqual({ value: '4', count: 2 });
    expect(s.rulesChanged).toBeCloseTo(1 / 3);
    expect(s.joins).toEqual([
      { value: 'qr', count: 2 },
      { value: 'link', count: 1 },
    ]);
    expect(s.rounds).toBe(4);
    expect(s.minutes).toBe(9);
    expect(s.winRate).toBe(0.5);
    expect(s.context.sound).toEqual([
      { value: 'true', count: 9 },
      { value: 'false', count: 1 },
    ]);
    expect(s.context.orientation[1]).toEqual({ value: 'landscape', count: 1 });
  });

  it('says nothing it does not know: an empty period', () => {
    const s = summarizeUsage([], '2026-11-22');
    expect(s.days).toHaveLength(30);
    expect(s.totals.started).toBe(0);
    expect(s.rulesChanged).toBe(0);
    expect(s.winRate).toBeNull();
    expect(s.rounds).toBe(0);
  });
});
