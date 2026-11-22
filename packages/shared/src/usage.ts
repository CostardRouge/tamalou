import { z } from 'zod';

// Anonymous usage statistics (ADR-0024, the owner's picks of 2026-11-22): what is played and how, never who. An event
// names no person, no device, no room code and no address; the server adds only the day it arrived. The browser sends
// one for a game started and ended, a room created or joined, under the same choice as the audience counter (the legal
// page's switch, Do Not Track, Global Privacy Control). The admin page (apps/worker) reads them through
// `summarizeUsage`.

export const USAGE_VERSION = 1;

/** How long the server keeps an event (13 months, the CNIL's ceiling for audience measurement). */
export const USAGE_KEEP_DAYS = 396;

/** A short word: what a device setting or a preset is called, never free text. */
const word = z
  .string()
  .max(24)
  .regex(/^[a-z0-9-]+$/);

/** How the device was set up when the event happened. */
export const UsageContextSchema = z.object({
  lang: z.enum(['fr', 'en']),
  device: z.enum(['phone', 'tablet', 'desktop']),
  orientation: z.enum(['portrait', 'landscape']),
  /** The Network Information API's guess, where the browser gives one. */
  connection: z.enum(['slow-2g', '2g', '3g', '4g', 'unknown']),
  /** Opened from the home screen (the installed game) rather than in a browser tab. */
  installed: z.boolean(),
  sound: z.boolean(),
  haptics: z.boolean(),
  hand: word,
  drawView: word,
  botPace: word,
  cardSpeed: word,
});
export type UsageContext = z.infer<typeof UsageContextSchema>;

const mode = z.enum(['solo', 'pass', 'online']);
const count = z.number().int().min(0).max(10);

export const UsageEventSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('gameStarted'),
    mode,
    players: count,
    humans: count,
    bots: count,
    level: z.enum(['easy', 'medium', 'hard']).nullable(),
    preset: word,
    rulesChanged: z.boolean(),
  }),
  z.object({
    kind: z.literal('gameEnded'),
    mode,
    players: count,
    rounds: z.number().int().min(0).max(500),
    minutes: z.number().int().min(0).max(1440),
    /** Whether this device's player won; null on a shared screen or for a watcher. */
    won: z.boolean().nullable(),
  }),
  z.object({ kind: z.literal('roomCreated') }),
  /** A seat taken in a room, and the way in: its QR code, a shared link, the code typed, or the room just made. */
  z.object({ kind: z.literal('roomJoined'), via: z.enum(['qr', 'link', 'code', 'created']) }),
]);
export type UsageEvent = z.infer<typeof UsageEventSchema>;

/** What the browser sends: the event and the device's context. */
export const UsageReportSchema = z.object({
  v: z.literal(USAGE_VERSION),
  event: UsageEventSchema,
  ctx: UsageContextSchema,
});
export type UsageReport = z.infer<typeof UsageReportSchema>;

/** The largest report the server reads: a report is a few hundred bytes. */
export const MAX_USAGE_REPORT = 2048;

/** A stored report and the day it arrived (UTC, YYYY-MM-DD). */
export interface UsageRow {
  day: string;
  report: UsageReport;
}

export const parseUsageReport = (raw: unknown): UsageReport | null => {
  const r = UsageReportSchema.safeParse(raw);
  return r.success ? r.data : null;
};

/** The UTC day of a date, YYYY-MM-DD. */
export const usageDay = (at: Date): string => at.toISOString().slice(0, 10);

/** The first day still kept on `today`. */
export function usageCutoff(today: string, keepDays = USAGE_KEEP_DAYS): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - keepDays);
  return usageDay(d);
}

/** How often each value came up, most frequent first. */
export type Tally = { value: string; count: number }[];

export interface UsageSummary {
  /** The days covered, oldest first, each with what happened that day. */
  days: { day: string; started: number; ended: number; rooms: number; joins: number }[];
  totals: { started: number; ended: number; rooms: number; joins: number };
  /** Games started, by mode. */
  modes: Tally;
  /** Games started, by table size. */
  players: Tally;
  /** Games started against bots only, humans only, or both. */
  opponents: Tally;
  levels: Tally;
  presets: Tally;
  /** Share of started games whose rules were changed, 0 to 1. */
  rulesChanged: number;
  /** Ways into a room. */
  joins: Tally;
  /** Over ended games: rounds and minutes on average, and how often the player won a solo game. */
  rounds: number;
  minutes: number;
  winRate: number | null;
  /** The devices, over every event of the period. */
  context: Record<keyof UsageContext, Tally>;
}

const CONTEXT_KEYS = Object.keys(UsageContextSchema.shape) as (keyof UsageContext)[];

function tally(values: readonly string[]): Tally {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts]
    .map(([value, n]) => ({ value, count: n }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

const mean = (xs: readonly number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

/** Everything the admin page shows for the `days` days up to `today` (included). */
export function summarizeUsage(rows: readonly UsageRow[], today: string, days = 30): UsageSummary {
  const first = usageCutoff(today, days - 1);
  const kept = rows.filter((r) => r.day >= first && r.day <= today);
  const byDay = new Map<string, UsageSummary['days'][number]>();
  for (let i = days - 1; i >= 0; i--) {
    const day = usageCutoff(today, i);
    byDay.set(day, { day, started: 0, ended: 0, rooms: 0, joins: 0 });
  }
  const started: Extract<UsageEvent, { kind: 'gameStarted' }>[] = [];
  const ended: Extract<UsageEvent, { kind: 'gameEnded' }>[] = [];
  const joins: string[] = [];
  for (const { day, report } of kept) {
    const d = byDay.get(day);
    const e = report.event;
    if (e.kind === 'gameStarted') {
      started.push(e);
      if (d) d.started++;
    } else if (e.kind === 'gameEnded') {
      ended.push(e);
      if (d) d.ended++;
    } else if (e.kind === 'roomCreated') {
      if (d) d.rooms++;
    } else {
      joins.push(e.via);
      if (d) d.joins++;
    }
  }
  const decided = ended.filter((e) => e.won !== null);
  const context = Object.fromEntries(
    CONTEXT_KEYS.map((k) => [k, tally(kept.map((r) => String(r.report.ctx[k])))]),
  ) as UsageSummary['context'];
  const list = [...byDay.values()];
  return {
    days: list,
    totals: {
      started: started.length,
      ended: ended.length,
      rooms: list.reduce((a, d) => a + d.rooms, 0),
      joins: joins.length,
    },
    modes: tally(started.map((e) => e.mode)),
    players: tally(started.map((e) => String(e.players))),
    opponents: tally(started.map((e) => (e.bots === 0 ? 'humans' : e.humans <= 1 ? 'bots' : 'mixed'))),
    levels: tally(started.flatMap((e) => (e.level && e.bots > 0 ? [e.level] : []))),
    presets: tally(started.map((e) => e.preset)),
    rulesChanged: started.length === 0 ? 0 : started.filter((e) => e.rulesChanged).length / started.length,
    joins: tally(joins),
    rounds: mean(ended.map((e) => e.rounds)),
    minutes: mean(ended.map((e) => e.minutes)),
    winRate: decided.length === 0 ? null : decided.filter((e) => e.won).length / decided.length,
    context,
  };
}
