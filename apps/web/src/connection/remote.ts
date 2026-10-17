import {
  type Action,
  type ClientMessage,
  type CloseReason,
  type GameEvent,
  type GameUpdate,
  type LobbyView,
  type PlayerId,
  PROTOCOL_VERSION,
  type RuleSet,
  rulesOf,
  type ServerMessage,
} from '@tamalou/shared';
import type { GameConnection, SendResult } from './types.ts';

// A seat in a room on a server (online or LAN, docs/SPEC.md §5.3): one WebSocket, the token that brings the seat back
// after a reload or a lost network, and automatic reconnection. RoomClient holds what the server last said (lobby,
// game); RemoteConnection shows it to the game screen as any other GameConnection.

/** Reasons after which trying again is pointless. */
const FINAL: CloseReason[] = ['notFound', 'kicked', 'expired', 'replaced', 'version', 'full', 'left'];
const TOKENS_KEY = 'tamalou-rooms';
/** A token is kept a day: a room never outlives two idle hours, and old entries are cleaned on the way. */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

type Tokens = Record<string, { token: string; at: number }>;

function readTokens(): Tokens {
  try {
    const raw = globalThis.localStorage?.getItem(TOKENS_KEY);
    const data = raw ? (JSON.parse(raw) as unknown) : {};
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    const now = Date.now();
    const out: Tokens = {};
    for (const [code, v] of Object.entries(data as Record<string, unknown>)) {
      const e = v as { token?: unknown; at?: unknown };
      if (typeof e?.token === 'string' && typeof e.at === 'number' && now - e.at < TOKEN_TTL_MS) {
        out[code] = { token: e.token, at: e.at };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeTokens(tokens: Tokens): void {
  try {
    globalThis.localStorage?.setItem(TOKENS_KEY, JSON.stringify(tokens));
  } catch {
    // Storage refused: a reload will ask for a name again, nothing else breaks.
  }
}

export const savedToken = (code: string): string | null => readTokens()[code]?.token ?? null;

export function saveToken(code: string, token: string | null): void {
  const tokens = readTokens();
  if (token) tokens[code] = { token, at: Date.now() };
  else delete tokens[code];
  writeTokens(tokens);
}

/** The API's base address: the page's own folder, so the app works at a domain's root and under a path. */
export function apiUrl(path: string, base: string = globalThis.location?.href ?? 'http://localhost/'): string {
  return new URL(`./api/${path}`, base).href;
}

/** Whether this page's server hosts rooms (it does on the LAN server and online; GitHub Pages does not). */
export async function roomsAvailable(timeoutMs = 2500): Promise<boolean> {
  try {
    const res = await fetch(apiUrl('health'), { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return false;
    const body = (await res.json()) as { ok?: unknown; v?: unknown };
    return body.ok === true && body.v === PROTOCOL_VERSION;
  } catch {
    return false;
  }
}

export async function createRoom(): Promise<string | null> {
  try {
    const res = await fetch(apiUrl('rooms'), { method: 'POST' });
    if (!res.ok) return null;
    const body = (await res.json()) as { code?: unknown };
    return typeof body.code === 'string' ? body.code : null;
  } catch {
    return null;
  }
}

export type ClientStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface Joining {
  code: string;
  /** For a new seat. */
  name?: string;
  /** Watch instead of sitting down. */
  spectate?: boolean;
}

export interface GameState {
  update: GameUpdate;
  log: GameEvent[];
}

/** The minimal WebSocket the client needs (the browser's, or a fake in tests). */
export type SocketFactory = (url: string) => WebSocket;

export class RoomClient {
  readonly code: string;
  status: ClientStatus = 'connecting';
  closedReason: CloseReason | null = null;
  seat: PlayerId | null = null;
  lobby: LobbyView | null = null;
  game: GameState | null = null;
  /** The last message the room refused, for a short notice. */
  refused: { about: string; error: string; at: number } | null = null;
  private joining: Joining;
  private socket: WebSocket | null = null;
  private readonly listeners = new Set<() => void>();
  private attempts = 0;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private readonly open: SocketFactory;
  private readonly wake = () => {
    if (this.status === 'reconnecting') this.reconnectNow();
  };

  constructor(joining: Joining, open: SocketFactory = (url) => new WebSocket(url)) {
    this.code = joining.code;
    this.joining = joining;
    this.open = open;
    this.connect();
    // A phone coming back to the page or to the network reconnects at once instead of waiting for the next retry.
    globalThis.addEventListener?.('online', this.wake);
    globalThis.document?.addEventListener('visibilitychange', this.wake);
  }

  get isGameMaster(): boolean {
    return this.seat !== null && this.lobby?.gm === this.seat;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  send(msg: ClientMessage): boolean {
    if (this.socket?.readyState !== 1) return false;
    this.socket.send(JSON.stringify(msg));
    return true;
  }

  /** A spectator takes a seat: the socket is reopened as a new player. */
  sit(name: string): void {
    this.joining = { code: this.code, name };
    this.reconnectNow();
  }

  /** Leave the room for good. */
  leave(): void {
    this.send({ t: 'leave' });
    saveToken(this.code, null);
    this.dispose();
  }

  dispose(): void {
    this.disposed = true;
    if (this.retry) clearTimeout(this.retry);
    globalThis.removeEventListener?.('online', this.wake);
    globalThis.document?.removeEventListener('visibilitychange', this.wake);
    const s = this.socket;
    this.socket = null;
    s?.close();
    this.listeners.clear();
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }

  private connect(): void {
    if (this.disposed) return;
    const url = apiUrl(`rooms/${this.code}/ws`).replace(/^http/, 'ws');
    const socket = this.open(url);
    this.socket = socket;
    socket.onopen = () => {
      const token = savedToken(this.code);
      const hello: ClientMessage = { t: 'hello', v: PROTOCOL_VERSION };
      if (token && !this.joining.spectate) hello.token = token;
      if (this.joining.name) hello.name = this.joining.name;
      if (this.joining.spectate) hello.spectate = true;
      socket.send(JSON.stringify(hello));
    };
    socket.onmessage = (e: MessageEvent) => {
      if (this.socket !== socket || typeof e.data !== 'string') return;
      try {
        this.receive(JSON.parse(e.data) as ServerMessage);
      } catch {
        // A message we cannot read: ignored, the next update brings the state anyway.
      }
    };
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      if (this.disposed || this.status === 'closed') return;
      this.status = 'reconnecting';
      this.notify();
      const wait = Math.min(1000 * 2 ** this.attempts, 10_000);
      this.attempts += 1;
      this.retry = setTimeout(() => this.connect(), wait);
    };
  }

  private reconnectNow(): void {
    if (this.retry) clearTimeout(this.retry);
    this.retry = null;
    const old = this.socket;
    this.socket = null;
    old?.close();
    this.attempts = 0;
    this.status = 'connecting';
    this.connect();
    this.notify();
  }

  private receive(msg: ServerMessage): void {
    switch (msg.t) {
      case 'welcome':
        this.status = 'open';
        this.attempts = 0;
        this.seat = msg.seat;
        if (msg.seat) saveToken(this.code, msg.token);
        // Once seated, a reconnection uses the token, never the name again.
        this.joining = { code: this.code };
        break;
      case 'lobby':
        // Back in the lobby (a replay): the last game is over for this screen.
        if (msg.lobby.phase === 'lobby') this.game = null;
        this.lobby = msg.lobby;
        break;
      case 'game': {
        const g = msg.game;
        const log = g.from === 0 ? g.events : [...(this.game?.log ?? []).slice(0, g.from), ...g.events];
        this.game = { update: g, log };
        break;
      }
      case 'refused':
        this.refused = { about: msg.about, error: msg.error, at: Date.now() };
        break;
      case 'closed':
        if (FINAL.includes(msg.reason)) {
          this.status = 'closed';
          this.closedReason = msg.reason;
          if (msg.reason !== 'replaced') saveToken(this.code, null);
        }
        break;
      case 'pong':
        return;
    }
    this.notify();
  }
}

/** What the game screen talks to during an online game. */
export class RemoteConnection implements GameConnection {
  private readonly client: RoomClient;
  private rulesKey = '';
  private rulesCache: RuleSet | null = null;

  constructor(client: RoomClient) {
    this.client = client;
  }

  get me(): PlayerId {
    return this.client.seat ?? '@table';
  }

  get rules(): RuleSet {
    const choice = this.client.lobby?.rules ?? { preset: 'classic', overrides: {} };
    const key = JSON.stringify(choice);
    if (key !== this.rulesKey || !this.rulesCache) {
      this.rulesKey = key;
      this.rulesCache = rulesOf(choice);
    }
    return this.rulesCache;
  }

  private get state(): GameState {
    if (!this.client.game) throw new Error('no game yet');
    return this.client.game;
  }

  view() {
    return this.state.update.view;
  }
  events() {
    return this.state.log;
  }
  send(action: Action): SendResult {
    const { by: _by, ...input } = action;
    // The server answers with the next update, or with a refusal shown as a notice.
    return this.client.send({ t: 'action', action: input as never }) ? { ok: true } : { ok: false, error: 'offline' };
  }
  continueRound() {
    this.client.send({ t: 'continue' });
  }
  readyForNext() {
    return this.state.update.readyForNext;
  }
  drawPending() {
    return this.state.update.drawPending;
  }
  subscribe(listener: () => void) {
    return this.client.subscribe(listener);
  }
  dispose() {
    // The room client outlives a game (replays): its owner disposes it.
  }
  presence(seat: PlayerId): 'offline' | 'away' | null {
    const s = this.client.lobby?.seats.find((x) => x.id === seat);
    if (!s || s.kind === 'bot') return null;
    if (s.away) return 'away';
    return s.connected ? null : 'offline';
  }
}
