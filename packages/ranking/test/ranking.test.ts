import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import {
  CODE_ALPHABET,
  drawName,
  formatCode,
  hashSecret,
  INITIAL_MU,
  INITIAL_SIGMA,
  LADDER_FORMAT,
  Ladder,
  type LadderFile,
  ladderRequest,
  monthsBefore,
  NAME_WORDS,
  nameText,
  newPlayerId,
  newSecret,
  normalizeCode,
  PLAYER_FILE_FORMAT,
  parseName,
  type Sql,
} from '../src/index.ts';

/** The ladder over node:sqlite, as the Durable Object runs it over its own SQLite. */
function memoryLadder(): { ladder: Ladder; db: DatabaseSync } {
  const db = new DatabaseSync(':memory:');
  const sql: Sql = {
    exec: <T>(query: string, ...bindings: (string | number | null)[]) =>
      db.prepare(query).all(...bindings) as unknown as Iterable<T>,
  };
  return { ladder: new Ladder(sql), db };
}

const NOW = new Date('2026-11-27T12:00:00.000Z');
const counter = (start = 0) => {
  let i = start;
  return (n: number) => Uint8Array.from({ length: n }, () => i++ % 256);
};
/** A name drawn from fixed numbers: card, adjective, number. */
const fixed = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length] ?? 0;
};

describe('the recovery code', () => {
  it('draws 25 symbols of the alphabet and shows them in five groups', () => {
    const secret = newSecret(counter());
    expect(secret).toHaveLength(25);
    expect([...secret].every((c) => CODE_ALPHABET.includes(c))).toBe(true);
    expect(secret.startsWith('0123456789ABCDEFGHJKMNPQR')).toBe(true);
    expect(formatCode(secret)).toBe('01234-56789-ABCDE-FGHJK-MNPQR');
    expect(newSecret()).not.toBe(newSecret());
  });

  it('forgives case, spaces, dashes and the letters that look like digits', () => {
    expect(normalizeCode(' o1234-56789-abcde-fghjk-mnpqr ')).toBe('0123456789ABCDEFGHJKMNPQR');
    expect(normalizeCode('O1234 56789 ABCDE FGHJK MNPQR')).toBe('0123456789ABCDEFGHJKMNPQR');
    expect(normalizeCode('l1234-56789-ABCDE-FGHJK-MNPQR')).toBe('1123456789ABCDEFGHJKMNPQR');
    expect(normalizeCode('01234-56789-ABCDE-FGHJK')).toBeNull();
    expect(normalizeCode('01234-56789-ABCDE-FGHJK-MNPQU')).toBeNull();
  });

  it('is kept as a hash that does not give it back', async () => {
    const h = await hashSecret('0123456789ABCDEFGHJKMNPQR');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(await hashSecret('0123456789ABCDEFGHJKMNPQR'));
    expect(h).not.toBe(await hashSecret('0123456789ABCDEFGHJKMNPQS'));
    expect(h).not.toContain('0123456789');
  });

  it('gives each player a 16-character id', () => {
    expect(newPlayerId(counter(250))).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(newPlayerId()).not.toBe(newPlayerId());
  });
});

describe('generated names', () => {
  it('writes a stored name in each language, the adjective agreeing with the card', () => {
    expect(nameText('10.0.57', 'fr')).toBe('Dame Rusée 057');
    expect(nameText('10.0.57', 'en')).toBe('Sly Queen 057');
    expect(nameText('11.1.7')).toBe('Roi Malin 007');
    expect(nameText('12.13.999', 'fr')).toBe('As Rêveur 999');
  });

  it('draws within the lists and reads back only a name it could have drawn', () => {
    expect(drawName(fixed(0.999, 0.999, 0.999))).toBe('12.15.999');
    expect(drawName(fixed(0, 0, 0))).toBe('0.0.0');
    expect(parseName(drawName())).not.toBeNull();
    expect(parseName('13.0.0')).toBeNull();
    expect(parseName('0.16.0')).toBeNull();
    expect(parseName('Dame Rusée')).toBeNull();
    expect(nameText('nope')).toBe('nope');
  });

  it('has as many words in every language', () => {
    for (const words of Object.values(NAME_WORDS)) {
      expect(words.cards).toHaveLength(NAME_WORDS.fr.cards.length);
      expect(words.adjectives).toHaveLength(NAME_WORDS.fr.adjectives.length);
    }
  });
});

describe('the ladder', () => {
  const player = (id: string, hash: string, now = NOW.toISOString()) => ({
    id,
    hash,
    name: '10.0.57',
    avatar: { color: 'teal' as const, icon: 'moon' as const },
    now,
  });

  it('creates a player once per secret, with the starting rating', () => {
    const { ladder } = memoryLadder();
    const p = ladder.create(player('aaaaaaaaaaaaaaaa', 'a'.repeat(64)));
    expect(p).toMatchObject({ games: 0, mu: INITIAL_MU, sigma: INITIAL_SIGMA, lastGame: null });
    expect(p?.avatar).toEqual({ color: 'teal', icon: 'moon' });
    expect(ladder.create(player('bbbbbbbbbbbbbbbb', 'a'.repeat(64)))).toBeNull();
    expect(ladder.count()).toBe(1);
  });

  it('keeps the avatar when none is sent, takes the new one or none when sent', () => {
    const { ladder } = memoryLadder();
    ladder.create(player('aaaaaaaaaaaaaaaa', 'a'.repeat(64)));
    ladder.touch('aaaaaaaaaaaaaaaa', undefined, '2026-11-28T00:00:00.000Z');
    expect(ladder.byId('aaaaaaaaaaaaaaaa')).toMatchObject({
      avatar: { color: 'teal' },
      seen: '2026-11-28T00:00:00.000Z',
    });
    ladder.touch('aaaaaaaaaaaaaaaa', { color: 'rose', icon: 'sun' }, '2026-11-29T00:00:00.000Z');
    expect(ladder.byId('aaaaaaaaaaaaaaaa')?.avatar).toEqual({ color: 'rose', icon: 'sun' });
    ladder.touch('aaaaaaaaaaaaaaaa', null, '2026-11-29T00:00:00.000Z');
    expect(ladder.byId('aaaaaaaaaaaaaaaa')?.avatar).toBeNull();
  });

  it('reads an avatar it can no longer parse as none', () => {
    const { ladder, db } = memoryLadder();
    ladder.create(player('aaaaaaaaaaaaaaaa', 'a'.repeat(64)));
    db.prepare("UPDATE players SET avatar = '{oops'").run();
    expect(ladder.byId('aaaaaaaaaaaaaaaa')?.avatar).toBeNull();
  });

  it('deletes a player 13 months after their last ranked game, or after joining when they never played', () => {
    const { ladder, db } = memoryLadder();
    const old = monthsBefore(NOW, 14);
    ladder.create(player('aaaaaaaaaaaaaaaa', 'a'.repeat(64), old)); // never played, joined 14 months ago
    ladder.create(player('bbbbbbbbbbbbbbbb', 'b'.repeat(64), old)); // joined then, played last month
    db.prepare('UPDATE players SET last_game = ? WHERE id = ?').run(monthsBefore(NOW, 1), 'bbbbbbbbbbbbbbbb');
    ladder.create(player('cccccccccccccccc', 'c'.repeat(64), monthsBefore(NOW, 12)));
    expect(ladder.prune(NOW)).toBe(1);
    expect(ladder.byId('aaaaaaaaaaaaaaaa')).toBeNull();
    expect(ladder.count()).toBe(2);
  });

  it('prunes at most once a day', () => {
    const { ladder } = memoryLadder();
    ladder.pruneDaily(NOW);
    ladder.create(player('aaaaaaaaaaaaaaaa', 'a'.repeat(64), monthsBefore(NOW, 14)));
    ladder.pruneDaily(NOW);
    expect(ladder.count()).toBe(1);
    ladder.pruneDaily(new Date('2026-11-28T08:00:00.000Z'));
    expect(ladder.count()).toBe(0);
  });

  it('exports everything, remembers when, and reads an export back without overwriting anyone', () => {
    const a = memoryLadder().ladder;
    a.create(player('aaaaaaaaaaaaaaaa', 'a'.repeat(64)));
    a.create(player('bbbbbbbbbbbbbbbb', 'b'.repeat(64)));
    expect(a.lastExport()).toBeNull();
    const file = a.exportFile(NOW);
    expect(file).toMatchObject({ format: LADDER_FORMAT, version: 1, at: NOW.toISOString() });
    expect(file.players.map((p) => p.id)).toEqual(['aaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbb']);
    expect(a.lastExport()).toBe(NOW.toISOString());

    const b = memoryLadder().ladder;
    b.create({ ...player('bbbbbbbbbbbbbbbb', 'b'.repeat(64)), name: '0.0.0' });
    const copy = JSON.parse(JSON.stringify(file)) as LadderFile;
    expect(b.importFile(copy)).toBe(1);
    expect(b.byId('aaaaaaaaaaaaaaaa')).toEqual(a.byId('aaaaaaaaaaaaaaaa'));
    expect(b.byId('bbbbbbbbbbbbbbbb')?.name).toBe('0.0.0');
    expect(b.importFile(copy)).toBe(0);
    expect(b.importFile({ format: 'other' })).toBeNull();
    expect(b.importFile({ ...copy, players: [{ ...copy.players[0], hash: 'short' }] })).toBeNull();
  });
});

describe('the profile API', () => {
  const SECRET = '0123456789ABCDEFGHJKMNPQR';
  const CODE = formatCode(SECRET).toLowerCase();
  const avatar = { color: 'violet', icon: 'crown' } as const;

  it('creates a profile with a generated name and the device avatar, once per secret', async () => {
    const { ladder } = memoryLadder();
    const made = await ladderRequest(ladder, 'create', { secret: SECRET, avatar }, NOW, fixed(10 / 13, 0, 0.057));
    expect(made.status).toBe(201);
    expect(made.body).toEqual({
      player: {
        id: expect.stringMatching(/^[A-Za-z0-9_-]{16}$/),
        name: '10.0.57',
        avatar,
        games: 0,
        created: NOW.toISOString(),
        lastGame: null,
      },
    });
    expect(JSON.stringify(made.body)).not.toContain(SECRET);
    expect((await ladderRequest(ladder, 'create', { secret: SECRET }, NOW)).status).toBe(409);
  });

  it('finds a profile from its code typed loosely, and updates its avatar', async () => {
    const { ladder } = memoryLadder();
    await ladderRequest(ladder, 'create', { secret: SECRET }, NOW);
    const me = await ladderRequest(ladder, 'me', { secret: CODE, avatar }, NOW);
    expect(me.status).toBe(200);
    expect((me.body as { player: { avatar: unknown } }).player.avatar).toEqual(avatar);
    expect((await ladderRequest(ladder, 'me', { secret: newSecret() }, NOW)).status).toBe(404);
  });

  it('draws another name', async () => {
    const { ladder } = memoryLadder();
    await ladderRequest(ladder, 'create', { secret: SECRET }, NOW, fixed(0, 0, 0));
    const renamed = await ladderRequest(ladder, 'rename', { secret: SECRET }, NOW, fixed(0, 0, 0, 0.5, 0.5, 0.5));
    expect((renamed.body as { player: { name: string } }).player.name).toBe('6.8.500');
  });

  it('hands over everything kept but the hash, then deletes it all', async () => {
    const { ladder } = memoryLadder();
    await ladderRequest(ladder, 'create', { secret: SECRET, avatar }, NOW, fixed(10 / 13, 0, 0.057));
    const data = await ladderRequest(ladder, 'data', { secret: SECRET }, NOW);
    expect(data.body).toMatchObject({
      format: PLAYER_FILE_FORMAT,
      player: { mu: INITIAL_MU, names: { fr: 'Dame Rusée 057', en: 'Sly Queen 057' } },
    });
    expect(JSON.stringify(data.body)).not.toContain(await hashSecret(SECRET));
    expect((await ladderRequest(ladder, 'delete', { secret: SECRET }, NOW)).status).toBe(204);
    expect(ladder.count()).toBe(0);
    expect((await ladderRequest(ladder, 'data', { secret: SECRET }, NOW)).status).toBe(404);
  });

  it('refuses what is not a call', async () => {
    const { ladder } = memoryLadder();
    expect((await ladderRequest(ladder, 'list', { secret: SECRET }, NOW)).status).toBe(404);
    expect((await ladderRequest(ladder, 'me', null, NOW)).status).toBe(400);
    expect((await ladderRequest(ladder, 'me', { secret: SECRET, avatar: 'blue' }, NOW)).status).toBe(400);
    expect((await ladderRequest(ladder, 'me', { secret: 'TAMA' }, NOW)).body).toEqual({ error: 'badCode' });
  });
});
