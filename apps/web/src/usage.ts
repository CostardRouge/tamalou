import { USAGE_VERSION, type UsageContext, type UsageEvent, type UsageReport } from '@tamalou/shared';
import { optedOut, privacySignal } from './audience.ts';
import { apiUrl } from './connection/remote.ts';
import { getSettings } from './feedback/settings.ts';
import { currentLang } from './i18n/index.ts';

// Anonymous usage statistics (ADR-0024), the owner's admin page's source: a game started and ended, a room created or
// joined, with how the device was set up. Never a name, a room code or an address (packages/shared usage.ts checks it
// on the server too); since 2026-11-27, unless the player switched it off, a number this device drew at random, so the
// owner sees devices come back (`deviceId` below). Sent under the audience counter's choice (the
// legal page's switch, Do Not Track, Global Privacy Control), and only to the online server: GitHub Pages has no API,
// and the LAN version counts nothing.

/** Whether this page's server takes reports: unknown until App asked it, then reports wait or go. */
let available: boolean | null = null;
const waiting: UsageReport[] = [];

/** The game on screen: what its end will report, if this device reports it. */
let current: { id: string; mode: 'solo' | 'pass' | 'online'; players: number; at: number; report: boolean } | null =
  null;

/** A random number (packages/shared usage.ts `gameId`, `deviceId`): 12 bytes, URL-safe. */
function newGameId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_');
}

const DEVICE_KEY = 'tamalou-device';
/** A device's number is drawn again after this long (13 months: the CNIL's ceiling for a measurement tracer's life). */
const DEVICE_DAYS = 396;

/**
 * This device's number for the statistics (the owner's pick, 2026-11-27: «savoir qui revient»): drawn at random and
 * kept here, drawn again once 13 months old (never prolonged), forgotten as soon as the player switches it off in the
 * settings. Undefined when off or when the storage is not there.
 */
export function deviceId(now = Date.now()): string | undefined {
  try {
    if (!getSettings().countDevice) {
      localStorage.removeItem(DEVICE_KEY);
      return undefined;
    }
    const kept = JSON.parse(localStorage.getItem(DEVICE_KEY) ?? 'null') as { id?: unknown; since?: unknown } | null;
    if (
      kept &&
      typeof kept.id === 'string' &&
      typeof kept.since === 'number' &&
      now - kept.since < DEVICE_DAYS * 86_400_000
    ) {
      return kept.id;
    }
    const id = newGameId();
    localStorage.setItem(DEVICE_KEY, JSON.stringify({ id, since: now }));
    return id;
  } catch {
    return undefined;
  }
}

/** App says, once it knows, whether reports go anywhere (the online server only). */
export function setUsageAvailable(ok: boolean): void {
  available = ok;
  const out = waiting.splice(0);
  if (ok) for (const r of out) send(r);
}

function device(): UsageContext['device'] {
  const coarse = globalThis.matchMedia?.('(pointer: coarse)').matches ?? false;
  if (!coarse) return 'desktop';
  return Math.min(innerWidth, innerHeight) < 600 ? 'phone' : 'tablet';
}

function connection(): UsageContext['connection'] {
  const type = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType;
  return type === 'slow-2g' || type === '2g' || type === '3g' || type === '4g' ? type : 'unknown';
}

/** How this device is set up right now. */
export function usageContext(): UsageContext {
  const s = getSettings();
  return {
    lang: currentLang() === 'en' ? 'en' : 'fr',
    device: device(),
    orientation: innerWidth > innerHeight ? 'landscape' : 'portrait',
    connection: connection(),
    installed: globalThis.matchMedia?.('(display-mode: standalone)').matches ?? false,
    sound: s.sound,
    haptics: s.haptics,
    hand: s.hand,
    drawView: s.drawView,
    botPace: s.botPace,
    cardSpeed: s.cardSpeed,
  };
}

function send(report: UsageReport): void {
  const body = JSON.stringify(report);
  try {
    // A beacon survives the page closing (the end of a game is often the end of a visit).
    if (navigator.sendBeacon?.(apiUrl('usage'), new Blob([body], { type: 'application/json' }))) return;
    void fetch(apiUrl('usage'), {
      method: 'POST',
      body,
      keepalive: true,
      headers: { 'content-type': 'application/json' },
    }).catch(() => {});
  } catch {
    // Nothing to do: a report is worth less than a game.
  }
}

/** Reports one event, if the visitor agrees and the server takes it. */
export function reportUsage(event: UsageEvent): void {
  if (available === false || optedOut() || privacySignal()) return;
  const device = deviceId();
  const report: UsageReport = { v: USAGE_VERSION, event, ctx: usageContext(), ...(device ? { deviceId: device } : {}) };
  if (available === null) {
    if (waiting.length < 10) waiting.push(report);
    return;
  }
  send(report);
}

/** A game begins on this screen; `report` says whether this device tells it (a room's game master only). */
export function startGame(
  game: Omit<Extract<UsageEvent, { kind: 'gameStarted' }>, 'kind' | 'game'>,
  report: boolean,
  now = Date.now(),
): void {
  const id = newGameId();
  current = { id, mode: game.mode, players: game.players, at: now, report };
  if (report) reportUsage({ kind: 'gameStarted', game: id, ...game });
}

/** The game on screen is over: its length, and whether this device's player won (null for a table, not a person). */
export function endGame(rounds: number, won: boolean | null, now = Date.now()): void {
  const game = current;
  current = null;
  if (!game?.report) return;
  reportUsage({
    kind: 'gameEnded',
    game: game.id,
    mode: game.mode,
    players: game.players,
    rounds: Math.min(rounds, 500),
    minutes: Math.min(Math.round((now - game.at) / 60_000), 1440),
    won: game.mode === 'solo' ? won : null,
  });
}
