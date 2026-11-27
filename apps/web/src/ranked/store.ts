import { normalizeCode } from '@tamalou/ranking';
import { useSyncExternalStore } from 'react';

// The ranked profile's secret on this device (ADR-0029): the one key to the player's ranked profile, drawn here and
// never shown to anyone but them. It also travels in «Mes parties»'s saved file, so restoring that file on another phone
// brings the profile back too.

const KEY = 'tamalou-ranked';

let secret: string | null | undefined;
const listeners = new Set<() => void>();

function load(): string | null {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const saved = raw ? (JSON.parse(raw) as { secret?: unknown }) : null;
    return typeof saved?.secret === 'string' ? normalizeCode(saved.secret) : null;
  } catch {
    return null;
  }
}

export function rankedSecret(): string | null {
  if (secret === undefined) secret = load();
  return secret;
}

function store(next: string | null): void {
  secret = next;
  try {
    if (next) globalThis.localStorage?.setItem(KEY, JSON.stringify({ secret: next }));
    else globalThis.localStorage?.removeItem(KEY);
  } catch {
    // Storage refused: the profile lasts as long as the page, and its code still brings it back.
  }
  for (const fn of listeners) fn();
}

export const saveRankedSecret = (s: string) => store(s);
export const forgetRanked = () => store(null);

/** Forgets what was read (tests, another tab). */
export function reloadRanked(): void {
  secret = undefined;
  for (const fn of listeners) fn();
}

export function useRankedSecret(): string | null {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    rankedSecret,
    rankedSecret,
  );
}

/** The ranked secret a saved «Mes parties» file carries, if any. */
export function rankedFromFile(text: string): string | null {
  try {
    const file = JSON.parse(text) as { ranked?: unknown };
    return typeof file?.ranked === 'string' ? normalizeCode(file.ranked) : null;
  } catch {
    return null;
  }
}
