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
/**
 * A number drawn at random by the device for one game, so its start and its end can be read together (the owner's go,
 * 2026-11-24). It names the game, never the device: two games of one phone carry unrelated numbers.
 */
const gameId = z.string().regex(/^[A-Za-z0-9_-]{8,32}$/);
const count = z.number().int().min(0).max(10);

export const UsageEventSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('gameStarted'),
    game: gameId.optional(),
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
    game: gameId.optional(),
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

/**
 * A stored report, the day it arrived (UTC, YYYY-MM-DD) and, since 2026-11-24, the minute (UTC, YYYY-MM-DDTHH:MM).
 * Reports kept before then have no minute: they count by day and are listed without a time.
 */
export interface UsageRow {
  day: string;
  at?: string;
  report: UsageReport;
}

export const parseUsageReport = (raw: unknown): UsageReport | null => {
  const r = UsageReportSchema.safeParse(raw);
  return r.success ? r.data : null;
};

/** The UTC day of a date, YYYY-MM-DD. */
export const usageDay = (at: Date): string => at.toISOString().slice(0, 10);

/** The UTC minute of a date, YYYY-MM-DDTHH:MM: all the server keeps of when a report came. */
export const usageMinute = (at: Date): string => at.toISOString().slice(0, 16);

/** The owner reads the page in France: days and hours are told in Paris time. */
export const USAGE_TIME_ZONE = 'Europe/Paris';

const paris = new Intl.DateTimeFormat('en-GB', {
  timeZone: USAGE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** A stored minute in Paris time: its day (YYYY-MM-DD), its hour and its time (HH:MM). */
export function localTime(at: string): { day: string; hour: number; time: string } {
  const parts = Object.fromEntries(paris.formatToParts(new Date(`${at}:00Z`)).map((p) => [p.type, p.value]));
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    time: `${parts.hour}:${parts.minute}`,
  };
}

/** The day a row counts for: its Paris day when it has a minute, else the day it was stored. */
export const rowDay = (row: UsageRow): string => (row.at ? localTime(row.at).day : row.day);

/** Monday 0 to Sunday 6, for a YYYY-MM-DD day. */
export const weekday = (day: string): number => (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;

/** The first day still kept on `today`. */
export function usageCutoff(today: string, keepDays = USAGE_KEEP_DAYS): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - keepDays);
  return usageDay(d);
}

/** One game, from its start and, when the device told it, its end. */
export interface UsageGame {
  /** Its random number, null for a game reported before numbers existed (it cannot be opened). */
  id: string | null;
  /** The Paris day and time it started (time null before 2026-11-24). */
  day: string;
  start: string | null;
  mode: Extract<UsageEvent, { kind: 'gameStarted' }>['mode'];
  players: number;
  humans: number;
  bots: number;
  level: Extract<UsageEvent, { kind: 'gameStarted' }>['level'];
  preset: string;
  rulesChanged: boolean;
  /** Null while no end was told (abandoned, or still going). */
  end: { day: string; time: string | null; rounds: number; minutes: number; won: boolean | null } | null;
  ctx: UsageContext;
}

/** The games among these rows, newest first: each start, with its end when one carries the same number. */
export function usageGames(rows: readonly UsageRow[]): UsageGame[] {
  const ends = new Map<string, UsageRow>();
  for (const r of rows) {
    const e = r.report.event;
    if (e.kind === 'gameEnded' && e.game) ends.set(e.game, r);
  }
  const games: (UsageGame & { sort: string })[] = [];
  for (const r of rows) {
    const e = r.report.event;
    if (e.kind !== 'gameStarted') continue;
    const endRow = e.game ? ends.get(e.game) : undefined;
    const ended = endRow?.report.event.kind === 'gameEnded' ? endRow.report.event : null;
    games.push({
      id: e.game ?? null,
      day: rowDay(r),
      start: r.at ? localTime(r.at).time : null,
      mode: e.mode,
      players: e.players,
      humans: e.humans,
      bots: e.bots,
      level: e.level,
      preset: e.preset,
      rulesChanged: e.rulesChanged,
      end:
        ended && endRow
          ? {
              day: rowDay(endRow),
              time: endRow.at ? localTime(endRow.at).time : null,
              rounds: ended.rounds,
              minutes: ended.minutes,
              won: ended.won,
            }
          : null,
      ctx: r.report.ctx,
      sort: r.at ?? `${r.day}T00:00`,
    });
  }
  return games.sort((a, b) => b.sort.localeCompare(a.sort)).map(({ sort: _sort, ...g }) => g);
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
  /** Games started by Paris hour (0–23; only those with a time) and by weekday (Monday first). */
  hours: number[];
  weekdays: number[];
  /** The period's games, newest first. */
  games: UsageGame[];
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
  const kept = rows.filter((r) => rowDay(r) >= first && rowDay(r) <= today);
  const byDay = new Map<string, UsageSummary['days'][number]>();
  for (let i = days - 1; i >= 0; i--) {
    const day = usageCutoff(today, i);
    byDay.set(day, { day, started: 0, ended: 0, rooms: 0, joins: 0 });
  }
  const started: Extract<UsageEvent, { kind: 'gameStarted' }>[] = [];
  const ended: Extract<UsageEvent, { kind: 'gameEnded' }>[] = [];
  const joins: string[] = [];
  const hours = Array.from({ length: 24 }, () => 0);
  const weekdays = Array.from({ length: 7 }, () => 0);
  for (const row of kept) {
    const day = rowDay(row);
    const d = byDay.get(day);
    const e = row.report.event;
    if (e.kind === 'gameStarted') {
      started.push(e);
      if (d) d.started++;
      weekdays[weekday(day)] = (weekdays[weekday(day)] ?? 0) + 1;
      if (row.at) {
        const h = localTime(row.at).hour;
        hours[h] = (hours[h] ?? 0) + 1;
      }
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
    hours,
    weekdays,
    games: usageGames(kept),
  };
}
