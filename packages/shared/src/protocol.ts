import { z } from 'zod';
import type { PlayerId } from './actions.ts';
import type { GameEvent } from './events.ts';
import type { RulesChoice } from './rulesIO.ts';
import type { PlayerView } from './view.ts';

// What travels between a client and a room server (online and LAN speak the same protocol, docs/SPEC.md §5.3–5.4).
// The client sends intentions; the server answers with its lobby, and during a game with this seat's view and the
// events it may see. Everything a client sends is parsed here first: the server trusts nothing that did not.

export const PROTOCOL_VERSION = 1;

/** Room codes: no I, O, 0 or 1, which read alike (docs/SPEC.md §5.3). */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 5;
export const MAX_NAME_LENGTH = 20;
/** The largest message a server accepts, in characters. A rules choice is the biggest thing a client sends. */
export const MAX_MESSAGE_LENGTH = 16_000;

/** A code as typed: upper case, without spaces or dashes; null when it cannot be a code. */
export function normalizeRoomCode(typed: string): string | null {
  const code = typed.toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== ROOM_CODE_LENGTH) return null;
  return [...code].every((c) => ROOM_CODE_ALPHABET.includes(c)) ? code : null;
}

/** A fresh code from a source of random numbers in [0, 1). */
export function newRoomCode(random: () => number): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

// ---------------------------------------------------------------- client → server

const slot = z.number().int().min(0).max(15);
const seatId = z.string().min(1).max(40);
const slotRef = z.object({ player: seatId, slot });

/** A player's action without `by`: the server fills it in with the sender's seat. */
export const ActionInputSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('choosePeek'), slots: z.array(slot).max(8) }),
  z.object({ type: z.literal('ready') }),
  z.object({ type: z.literal('draw'), from: z.enum(['deck', 'discard']) }),
  z.object({ type: z.literal('swap'), slot }),
  z.object({ type: z.literal('discardDrawn') }),
  z.object({ type: z.literal('usePower'), targets: z.array(slotRef).max(2) }),
  z.object({ type: z.literal('skipPower') }),
  z.object({ type: z.literal('endReveal') }),
  z.object({ type: z.literal('queenDecide'), swapWith: slotRef.nullable() }),
  z.object({ type: z.literal('callTamalou') }),
  z.object({ type: z.literal('passCall') }),
  z.object({
    type: z.literal('quickDiscard'),
    target: slotRef,
    expectTop: z.number().int().min(0),
    give: slot.optional(),
  }),
]);
export type ActionInput = z.infer<typeof ActionInputSchema>;

export const BOT_LEVEL_NAMES = ['easy', 'medium', 'hard'] as const;

const name = z.string().trim().min(1).max(MAX_NAME_LENGTH);

export const ClientMessageSchema = z.discriminatedUnion('t', [
  /** First message on a socket: a token to take one's seat back, or a name to sit down (or watch). */
  z.object({
    t: z.literal('hello'),
    v: z.number().int(),
    token: z.string().max(100).optional(),
    name: name.optional(),
    spectate: z.boolean().optional(),
  }),
  z.object({ t: z.literal('setName'), name }),
  z.object({ t: z.literal('ready'), ready: z.boolean() }),
  /** Game master: the table's rules (checked again with checkRulesChoice). */
  z.object({ t: z.literal('setRules'), choice: z.object({ preset: z.string().max(40), overrides: z.unknown() }) }),
  /** Game master: a bot sits down; its name comes from the game master's language. */
  z.object({ t: z.literal('addBot'), level: z.enum(BOT_LEVEL_NAMES), name: name.optional() }),
  /** Game master, in the lobby: a bot leaves, or a player is shown the door. */
  z.object({ t: z.literal('remove'), seat: seatId }),
  z.object({ t: z.literal('start') }),
  z.object({ t: z.literal('action'), action: ActionInputSchema }),
  /** Ready for the next round. */
  z.object({ t: z.literal('continue') }),
  /** Game master, after a game: back to the lobby with the same players and rules. */
  z.object({ t: z.literal('replay') }),
  /** Leave the room for good (the seat is freed in the lobby, played by a bot in a game). */
  z.object({ t: z.literal('leave') }),
  z.object({ t: z.literal('ping') }),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

/** Parses a raw socket message; null when it is not valid JSON or not a message we know. */
export function parseClientMessage(raw: string): ClientMessage | null {
  if (raw.length > MAX_MESSAGE_LENGTH) return null;
  try {
    const parsed = ClientMessageSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- server → client

export type RoomPhase = 'lobby' | 'playing' | 'over';

export interface SeatInfo {
  id: PlayerId;
  name: string;
  kind: 'human' | 'bot';
  level?: (typeof BOT_LEVEL_NAMES)[number];
  /** Lobby: ready to start (the game master is always ready). */
  ready: boolean;
  /** A human with an open connection. Bots are always connected. */
  connected: boolean;
  /** A human gone long enough for a bot to play in their place. */
  away: boolean;
}

export interface LobbyView {
  code: string;
  phase: RoomPhase;
  /** The game master's seat. */
  gm: PlayerId | null;
  seats: SeatInfo[];
  rules: RulesChoice;
  spectators: number;
}

export interface GameUpdate {
  view: PlayerView;
  /** New events since the last update on this connection; `from` is the index of the first one in the full log. */
  from: number;
  events: GameEvent[];
  readyForNext: PlayerId[];
  drawPending: boolean;
}

export type CloseReason =
  /** No room with this code (never made, or closed). */
  | 'notFound'
  /** The game master removed this player. */
  | 'kicked'
  /** The room had nothing happening for too long. */
  | 'expired'
  /** The same seat was opened somewhere else. */
  | 'replaced'
  /** The client speaks another protocol version: reload the page. */
  | 'version'
  /** Six players already; watching is still possible. */
  | 'full'
  /** The player left. */
  | 'left';

export type ServerMessage =
  /** Answer to hello: the token to keep for coming back, and the seat (null for a spectator). */
  | { t: 'welcome'; v: number; code: string; token: string; seat: PlayerId | null }
  | { t: 'lobby'; lobby: LobbyView }
  | { t: 'game'; game: GameUpdate }
  /** A message the room refused, with the reason (an engine error code for an action). */
  | { t: 'refused'; about: ClientMessage['t'] | 'message'; error: string }
  | { t: 'closed'; reason: CloseReason }
  | { t: 'pong' };
