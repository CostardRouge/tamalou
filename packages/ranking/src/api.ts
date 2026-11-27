import { AvatarSchema } from '@tamalou/shared';
import { z } from 'zod';
import { hashSecret, newPlayerId, normalizeCode } from './identity.ts';
import { type Ladder, type LadderPlayer, publicPlayer } from './ladder.ts';
import { drawName, NAME_LANGS, nameText } from './names.ts';

// The ranked profile's API (ADR-0029, step R0), answered inside the `LadderObject`; the Worker only routes, limits and
// reads the body. Every call is a POST whose JSON body carries the secret: it never travels in an address, so it never
// lands in a log or a history.
//
//   POST /api/ladder/create   { secret, avatar? } → 201 { player }   (409 when the secret already has one)
//   POST /api/ladder/me       { secret, avatar? } → 200 { player }   (404: the code is unknown; also how a code is restored)
//   POST /api/ladder/rename   { secret }          → 200 { player }   (a new generated name)
//   POST /api/ladder/data     { secret }          → 200 the player's data, as a file to download
//   POST /api/ladder/delete   { secret }          → 204

export const LADDER_OPS = ['create', 'me', 'rename', 'data', 'delete'] as const;
export type LadderOp = (typeof LADDER_OPS)[number];

/** The longest body worth reading: a secret and an avatar. */
export const MAX_LADDER_BODY = 512;

const BodySchema = z.object({
  secret: z.string().max(64),
  avatar: AvatarSchema.nullable().optional(),
});

export interface LadderReply {
  status: number;
  body?: unknown;
}

export const PLAYER_FILE_FORMAT = 'tamalou-ranked-player';

const fail = (status: number, error: string): LadderReply => ({ status, body: { error } });
const ok = (player: LadderPlayer, status = 200): LadderReply => ({ status, body: { player } });

/** Answers one call; `random` draws names (tests fix it). */
export async function ladderRequest(
  ladder: Ladder,
  op: string,
  raw: unknown,
  now: Date,
  random: () => number = Math.random,
): Promise<LadderReply> {
  if (!(LADDER_OPS as readonly string[]).includes(op)) return fail(404, 'notFound');
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return fail(400, 'badRequest');
  const secret = normalizeCode(parsed.data.secret);
  if (!secret) return fail(400, 'badCode');
  ladder.pruneDaily(now);
  const hash = await hashSecret(secret);
  const at = now.toISOString();

  if (op === 'create') {
    const player = ladder.create({
      id: newPlayerId(),
      hash,
      name: drawName(random),
      avatar: parsed.data.avatar ?? null,
      now: at,
    });
    return player ? ok(publicPlayer(player), 201) : fail(409, 'exists');
  }

  const found = ladder.byHash(hash);
  if (!found) return fail(404, 'unknown');

  switch (op as Exclude<LadderOp, 'create'>) {
    case 'me': {
      ladder.touch(found.id, parsed.data.avatar, at);
      return ok(publicPlayer(ladder.byId(found.id) ?? found));
    }
    case 'rename': {
      let name = drawName(random);
      // A new name, not the same one drawn again.
      for (let i = 0; i < 5 && name === found.name; i++) name = drawName(random);
      ladder.rename(found.id, name);
      return ok(publicPlayer(ladder.byId(found.id) ?? found));
    }
    case 'data': {
      const { hash: _hash, ...mine } = found;
      return {
        status: 200,
        body: {
          format: PLAYER_FILE_FORMAT,
          version: 1,
          exported: at,
          // Everything kept but the secret's hash, and the name as each language writes it.
          player: { ...mine, names: Object.fromEntries(NAME_LANGS.map((l) => [l, nameText(found.name, l)])) },
        },
      };
    }
    case 'delete': {
      ladder.remove(found.id);
      return { status: 204 };
    }
  }
}
