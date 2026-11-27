import type { LadderOp } from '@tamalou/ranking';
import { type Avatar, parseAvatar } from '@tamalou/shared';
import { apiUrl } from '../connection/remote.ts';

// The ranked profile's calls to the online Worker (packages/ranking api.ts). The secret travels in the body of a POST,
// never in an address.

export interface RankedPlayer {
  id: string;
  /** The generated name, as stored ("10.0.57"): written in the reader's language by nameText. */
  name: string;
  avatar: Avatar | null;
  games: number;
  created: string;
  lastGame: string | null;
}

export type RankedError = 'unknown' | 'exists' | 'badCode' | 'slowDown' | 'offline';
export type Answer<T> = { ok: true; value: T } | { ok: false; error: RankedError };

async function call(op: LadderOp, body: object): Promise<{ status: number; body: unknown } | null> {
  try {
    const res = await fetch(apiUrl(`ladder/${op}`), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  } catch {
    return null;
  }
}

function failure(r: { status: number; body: unknown } | null): { ok: false; error: RankedError } {
  if (!r) return { ok: false, error: 'offline' };
  if (r.status === 404) return { ok: false, error: 'unknown' };
  if (r.status === 409) return { ok: false, error: 'exists' };
  if (r.status === 429) return { ok: false, error: 'slowDown' };
  if (r.status === 400) return { ok: false, error: 'badCode' };
  return { ok: false, error: 'offline' };
}

/** A player as the server sent it; null when it is not one. */
export function readPlayer(raw: unknown): RankedPlayer | null {
  const p = (raw as { player?: Record<string, unknown> } | null)?.player;
  if (!p || typeof p.id !== 'string' || typeof p.name !== 'string' || typeof p.games !== 'number') return null;
  return {
    id: p.id,
    name: p.name,
    avatar: parseAvatar(p.avatar),
    games: p.games,
    created: typeof p.created === 'string' ? p.created : '',
    lastGame: typeof p.lastGame === 'string' ? p.lastGame : null,
  };
}

async function player(op: LadderOp, body: object, ok: number): Promise<Answer<RankedPlayer>> {
  const r = await call(op, body);
  const p = r?.status === ok ? readPlayer(r.body) : null;
  return p ? { ok: true, value: p } : failure(r);
}

export const createProfile = (secret: string, avatar: Avatar | null) => player('create', { secret, avatar }, 201);
/** The profile behind a secret, telling the server the avatar this device shows (also how a typed code is checked). */
export const fetchProfile = (secret: string, avatar?: Avatar | null) =>
  player('me', avatar === undefined ? { secret } : { secret, avatar }, 200);
export const renameProfile = (secret: string) => player('rename', { secret }, 200);

/** Everything the server keeps about the player, as the text of a file to save. */
export async function profileData(secret: string): Promise<Answer<string>> {
  const r = await call('data', { secret });
  return r?.status === 200 ? { ok: true, value: JSON.stringify(r.body, null, 2) } : failure(r);
}

export async function deleteProfile(secret: string): Promise<Answer<true>> {
  const r = await call('delete', { secret });
  return r?.status === 204 ? { ok: true, value: true } : failure(r);
}
