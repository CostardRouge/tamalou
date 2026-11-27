import type { GameEvent, PlayerId, PlayerView } from '@tamalou/shared';
import { useSyncExternalStore } from 'react';

// The games played on this device (the owner's pick HistoA on the 2026-11-24 canvas, ADR-0025): one line per game
// finished here, kept in localStorage and nowhere else, for «Mes parties» (the counts, the last games). A file saves it
// and brings it back on another phone, or after the browser was cleared; there is no account to do it for the player.

const KEY = 'tamalou-history';
/** The oldest games go first past this many: a line is about 200 bytes, the whole well under 200 kB. */
export const MAX_GAMES = 500;
const FILE_FORMAT = 'tamalou-history';

export type PlayedMode = 'solo' | 'pass' | 'online';

export interface PlayedGame {
  /** When it ended, in ms since the epoch: with `total`, what tells two games apart. */
  at: number;
  mode: PlayedMode;
  /** My place at the end, 1 for a winner; players on equal points share a place. */
  place: number;
  players: number;
  /** The others' names, as the table showed them. */
  others: string[];
  /** My points at the end. */
  total: number;
  rounds: number;
  won: boolean;
  /** Tamalou called, and called without failing. */
  called: number;
  made: number;
}

const MODES: readonly PlayedMode[] = ['solo', 'pass', 'online'];
const int = (x: unknown, min: number, max: number): x is number =>
  typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max;

/** One game as read from storage or a file; null when it is not one. */
function readGame(raw: unknown): PlayedGame | null {
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as Record<string, unknown>;
  if (!int(g.at, 0, 8.64e15) || !MODES.includes(g.mode as PlayedMode)) return null;
  if (!int(g.place, 1, 99) || !int(g.players, 1, 99) || !int(g.rounds, 0, 10_000)) return null;
  if (!int(g.total, -10_000, 100_000) || !int(g.called, 0, 10_000) || !int(g.made, 0, 10_000)) return null;
  if (typeof g.won !== 'boolean' || !Array.isArray(g.others)) return null;
  const others = g.others.filter((n): n is string => typeof n === 'string').map((n) => n.slice(0, 20));
  return {
    at: g.at,
    mode: g.mode as PlayedMode,
    place: g.place,
    players: g.players,
    others: others.slice(0, 20),
    total: g.total,
    rounds: g.rounds,
    won: g.won,
    called: g.called,
    made: Math.min(g.made, g.called),
  };
}

const keyOf = (g: PlayedGame) => `${g.at}:${g.total}`;

/** Newest first, each game once, at most MAX_GAMES. */
function tidy(games: PlayedGame[]): PlayedGame[] {
  const seen = new Set<string>();
  return games
    .filter((g) => {
      const k = keyOf(g);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_GAMES);
}

function load(): PlayedGame[] {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? tidy(list.map(readGame).filter((g): g is PlayedGame => g !== null)) : [];
  } catch {
    return [];
  }
}

let games: PlayedGame[] | null = null;
const listeners = new Set<() => void>();

function store(next: PlayedGame[]): void {
  games = tidy(next);
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(games));
  } catch {
    // Storage full or refused: the list lasts as long as the page.
  }
  for (const fn of listeners) fn();
}

export function playedGames(): PlayedGame[] {
  games ??= load();
  return games;
}

/** Forgets what was read (tests, another tab). */
export function reloadHistory(): void {
  games = null;
  for (const fn of listeners) fn();
}

export function useHistory(): PlayedGame[] {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    playedGames,
    playedGames,
  );
}

/**
 * The line for a game that just ended, seen from `me`; null when `me` is not at the table (a spectator) or the game
 * is not over.
 */
export function gameLine(
  view: PlayerView,
  events: readonly GameEvent[],
  me: PlayerId,
  mode: PlayedMode,
  at: number,
): PlayedGame | null {
  if (view.phase !== 'gameOver') return null;
  const mine = view.players.find((p) => p.id === me);
  if (!mine) return null;
  const winners = view.winners ?? [];
  const won = winners.includes(me);
  let called = 0;
  let made = 0;
  for (const e of events) {
    if (e.type !== 'roundEnded' || e.result.caller !== me) continue;
    called++;
    if (!e.result.callerFailed) made++;
  }
  return {
    at,
    mode,
    place: won ? 1 : 1 + view.players.filter((p) => p.id !== me && p.total < mine.total).length,
    players: view.players.length,
    others: view.players.filter((p) => p.id !== me).map((p) => p.name),
    total: mine.total,
    rounds: view.lastResult?.round ?? 0,
    won,
    called,
    made,
  };
}

/** The games already kept, by the event that ended them: a panel drawn twice keeps its game once. */
const kept = new WeakSet<object>();

/** Keeps the game that `events` ended, once. */
export function recordGame(line: PlayedGame | null, events: readonly GameEvent[]): void {
  const end = events.findLast((e) => e.type === 'gameEnded');
  if (!line || !end || kept.has(end)) return;
  kept.add(end);
  store([line, ...playedGames()]);
}

export interface HistorySummary {
  games: number;
  won: number;
  made: number;
  since: number | null;
}

export function summarize(list: readonly PlayedGame[]): HistorySummary {
  return {
    games: list.length,
    won: list.filter((g) => g.won).length,
    made: list.reduce((n, g) => n + g.made, 0),
    since: list.length ? Math.min(...list.map((g) => g.at)) : null,
  };
}

/** The file «Sauvegarder» writes; with the ranked profile's secret when this device has one (ADR-0029). */
export function historyFile(list: readonly PlayedGame[], ranked: string | null = null): string {
  return JSON.stringify({ format: FILE_FORMAT, version: 1, games: list, ...(ranked ? { ranked } : {}) });
}

/** Adds a saved file's games to these; the number added, or null when the file is not a saved history. */
export function restoreHistory(text: string): number | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const file = parsed as { format?: unknown; games?: unknown };
  if (!file || file.format !== FILE_FORMAT || !Array.isArray(file.games)) return null;
  const before = playedGames();
  const known = new Set(before.map(keyOf));
  const fresh = file.games.map(readGame).filter((g): g is PlayedGame => g !== null && !known.has(keyOf(g)));
  if (fresh.length) store([...before, ...fresh]);
  return tidy(fresh).length;
}
