import { type Avatar, AvatarSchema, parseAvatar } from '@tamalou/shared';
import { z } from 'zod';
import { parseName } from './names.ts';

// The ladder's storage (ADR-0029): ranked players in SQLite, the online Worker's `LadderObject` running it over its
// Durable Object storage, the tests over node:sqlite. Nothing here knows Cloudflare.
//
// Kept per player: the hash of their secret, the generated name, the avatar, the rating (OpenSkill's μ and σ, used
// from R1 on), the number of ranked games, and three dates. A player with no ranked game for 13 months (or, never
// having played, 13 months after they were created) is deleted; so is one who asks. Unlike the usage statistics, the
// ladder is backed up: a JSON export the owner downloads from /admin/, which `importFile` reads back.

/** What both SQLite flavours offer: run a statement with its bindings, iterate the rows it returns. */
export interface Sql {
  exec<T extends Record<string, string | number | null>>(
    query: string,
    ...bindings: (string | number | null)[]
  ): Iterable<T>;
}

/** OpenSkill's starting rating (Weng-Lin): μ 25, σ 25/3. */
export const INITIAL_MU = 25;
export const INITIAL_SIGMA = 25 / 3;
/** How long a player who stopped playing is kept, as the usage statistics are. */
export const KEEP_MONTHS = 13;

/** A player as stored and exported: everything, the secret's hash included (it cannot give the secret back). */
export const StoredPlayerSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{16}$/),
  hash: z.string().regex(/^[0-9a-f]{64}$/),
  name: z.string().refine((s) => parseName(s) !== null),
  avatar: AvatarSchema.nullable(),
  mu: z.number().finite(),
  sigma: z.number().finite().positive(),
  games: z.number().int().min(0),
  created: z.string().datetime(),
  lastGame: z.string().datetime().nullable(),
  seen: z.string().datetime(),
});
export type StoredPlayer = z.infer<typeof StoredPlayerSchema>;

/** A player as they see themselves. */
export type LadderPlayer = Omit<StoredPlayer, 'hash' | 'mu' | 'sigma' | 'seen'>;

export const LADDER_FORMAT = 'tamalou-ladder';
export const LadderFileSchema = z.object({
  format: z.literal(LADDER_FORMAT),
  version: z.literal(1),
  at: z.string().datetime(),
  players: z.array(StoredPlayerSchema),
});
export type LadderFile = z.infer<typeof LadderFileSchema>;

type Row = {
  id: string;
  hash: string;
  name: string;
  avatar: string | null;
  mu: number;
  sigma: number;
  games: number;
  created: string;
  last_game: string | null;
  seen: string;
};

const COLUMNS = 'id, hash, name, avatar, mu, sigma, games, created, last_game, seen';

function stored(r: Row): StoredPlayer {
  let avatar: Avatar | null = null;
  try {
    avatar = r.avatar ? parseAvatar(JSON.parse(r.avatar)) : null;
  } catch {
    avatar = null;
  }
  return {
    id: r.id,
    hash: r.hash,
    name: r.name,
    avatar,
    mu: r.mu,
    sigma: r.sigma,
    games: r.games,
    created: r.created,
    lastGame: r.last_game,
    seen: r.seen,
  };
}

/** What a player is shown of themselves. */
export function publicPlayer(p: StoredPlayer): LadderPlayer {
  return { id: p.id, name: p.name, avatar: p.avatar, games: p.games, created: p.created, lastGame: p.lastGame };
}

/** The ISO instant `months` months before `now`. */
export function monthsBefore(now: Date, months = KEEP_MONTHS): string {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString();
}

export class Ladder {
  private readonly sql: Sql;

  constructor(sql: Sql) {
    this.sql = sql;
    sql.exec(
      `CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY, hash TEXT NOT NULL UNIQUE, name TEXT NOT NULL, avatar TEXT,
        mu REAL NOT NULL, sigma REAL NOT NULL, games INTEGER NOT NULL DEFAULT 0,
        created TEXT NOT NULL, last_game TEXT, seen TEXT NOT NULL)`,
    );
    sql.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  }

  private one(query: string, ...bindings: (string | number | null)[]): Row | null {
    for (const r of this.sql.exec<Row>(query, ...bindings)) return r;
    return null;
  }

  private meta(key: string): string | null {
    for (const r of this.sql.exec<{ value: string }>('SELECT value FROM meta WHERE key = ?', key)) return r.value;
    return null;
  }

  private setMeta(key: string, value: string): void {
    this.sql.exec('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', key, value);
  }

  /** A new player; null when this secret already has one. */
  create(p: { id: string; hash: string; name: string; avatar: Avatar | null; now: string }): StoredPlayer | null {
    if (this.byHash(p.hash)) return null;
    this.sql.exec(
      `INSERT INTO players (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, 0, ?, NULL, ?)`,
      p.id,
      p.hash,
      p.name,
      p.avatar ? JSON.stringify(p.avatar) : null,
      INITIAL_MU,
      INITIAL_SIGMA,
      p.now,
      p.now,
    );
    return this.byId(p.id);
  }

  byHash(hash: string): StoredPlayer | null {
    const r = this.one(`SELECT ${COLUMNS} FROM players WHERE hash = ?`, hash);
    return r ? stored(r) : null;
  }

  byId(id: string): StoredPlayer | null {
    const r = this.one(`SELECT ${COLUMNS} FROM players WHERE id = ?`, id);
    return r ? stored(r) : null;
  }

  /** The player came back: when, and the avatar their device now shows (kept as it was when none is sent). */
  touch(id: string, avatar: Avatar | null | undefined, now: string): void {
    if (avatar === undefined) this.sql.exec('UPDATE players SET seen = ? WHERE id = ?', now, id);
    else
      this.sql.exec('UPDATE players SET seen = ?, avatar = ? WHERE id = ?', now, avatar && JSON.stringify(avatar), id);
  }

  rename(id: string, name: string): void {
    this.sql.exec('UPDATE players SET name = ? WHERE id = ?', name, id);
  }

  remove(id: string): void {
    this.sql.exec('DELETE FROM players WHERE id = ?', id);
  }

  count(): number {
    for (const r of this.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM players')) return r.n;
    return 0;
  }

  /** Deletes the players gone for 13 months; the number deleted. */
  prune(now: Date): number {
    const cutoff = monthsBefore(now);
    const before = this.count();
    this.sql.exec('DELETE FROM players WHERE COALESCE(last_game, created) < ?', cutoff);
    return before - this.count();
  }

  /** Prunes at most once a (UTC) day: on the first request of the day. */
  pruneDaily(now: Date): void {
    const day = now.toISOString().slice(0, 10);
    if (this.meta('pruned') === day) return;
    this.setMeta('pruned', day);
    this.prune(now);
  }

  /** The whole ladder as a file, and the moment remembered as the last export. */
  exportFile(now: Date): LadderFile {
    const players = [...this.sql.exec<Row>(`SELECT ${COLUMNS} FROM players ORDER BY created, id`)].map(stored);
    const at = now.toISOString();
    this.setMeta('exported', at);
    return { format: LADDER_FORMAT, version: 1, at, players };
  }

  /** When the ladder was last exported, or null. */
  lastExport(): string | null {
    return this.meta('exported');
  }

  /**
   * Reads an export back, adding only the players this ladder does not have (by id or by secret): restoring never
   * overwrites a player who kept playing. The number added, or null when the file is not an export.
   */
  importFile(raw: unknown): number | null {
    const file = LadderFileSchema.safeParse(raw);
    if (!file.success) return null;
    let added = 0;
    for (const p of file.data.players) {
      if (this.byId(p.id) || this.byHash(p.hash)) continue;
      this.sql.exec(
        `INSERT INTO players (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        p.id,
        p.hash,
        p.name,
        p.avatar ? JSON.stringify(p.avatar) : null,
        p.mu,
        p.sigma,
        p.games,
        p.created,
        p.lastGame,
        p.seen,
      );
      added++;
    }
    return added;
  }
}
