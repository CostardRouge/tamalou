import { MAX_PLAYERS, MIN_PLAYERS } from '@tamalou/engine';
import {
  type ClientMessage,
  type CloseReason,
  checkRulesChoice,
  type LobbyView,
  type PlayerId,
  PROTOCOL_VERSION,
  type RoomPhase,
  type RulesChoice,
  rulesOf,
  type SeatInfo,
  type ServerMessage,
} from '@tamalou/shared';
import { SPECTATOR } from './handoff.ts';
import { type Scheduler, Table } from './table.ts';

// A room (docs/SPEC.md §5.3): the lobby around a Table, for the online and LAN servers alike. Pure: the adapter hands
// it each connection's parsed messages and gives it a clock and a way to send; the room decides everything else.
//
// - The first player in is the game master: rules, bots, removing a player, starting, replaying.
// - Each player gets a token on arrival; a hello with that token takes the seat back (reload, lost network).
// - A player whose connection drops is shown disconnected at once and marked away after `awayMs`: their stand-in bot
//   plays for them until they come back, and the game master's role passes to someone still here.
// - Anyone arriving during a game watches it as a spectator (public information only).
// - The room closes after `idleMs` without a message from anyone, or once a finished game has nobody left watching.

export type ConnId = string;

export interface RoomOptions {
  code: string;
  scheduler: Scheduler;
  send(conn: ConnId, msg: ServerMessage): void;
  /** Close this connection (after the room sent it a `closed` message). */
  drop(conn: ConnId): void;
  /** The room is over: the adapter can forget it. */
  onClose?(reason: CloseReason): void;
  /** Tokens: long and unguessable. */
  token?(): string;
  /** Game seeds. */
  random?(): number;
  /** Inactivity before the room closes (default two hours). */
  idleMs?: number;
  /** Disconnection before a bot plays for the player (default 30 s). */
  awayMs?: number;
}

export const DEFAULT_IDLE_MS = 2 * 60 * 60 * 1000;
export const DEFAULT_AWAY_MS = 30_000;
const MAX_SPECTATORS = 20;
const BOT_LEVEL = 'medium';

interface Seat {
  id: PlayerId;
  name: string;
  kind: 'human' | 'bot';
  level?: SeatInfo['level'];
  /** null once the player left for good. */
  token: string | null;
  ready: boolean;
  conn: ConnId | null;
  away: boolean;
  awayTimer: unknown;
}

interface Conn {
  id: ConnId;
  /** Set by hello; null for a spectator. */
  seat: PlayerId | null;
  welcomed: boolean;
  /** Game events already sent on this connection. */
  sent: number;
}

export class Room {
  readonly code: string;
  private readonly opts: RoomOptions;
  private readonly scheduler: Scheduler;
  private readonly seats: Seat[] = [];
  private readonly conns = new Map<ConnId, Conn>();
  private phase: RoomPhase = 'lobby';
  private gm: PlayerId | null = null;
  private rules: RulesChoice = { preset: 'classic', overrides: {} };
  private table: Table | null = null;
  private unsubscribe: (() => void) | null = null;
  private idleTimer: unknown = null;
  private seatSeq = 0;
  private closedWith: CloseReason | null = null;

  constructor(opts: RoomOptions) {
    this.code = opts.code;
    this.opts = opts;
    this.scheduler = opts.scheduler;
    this.touch();
  }

  get closed(): boolean {
    return this.closedWith !== null;
  }

  /** The lobby as everyone sees it. */
  lobby(): LobbyView {
    return {
      code: this.code,
      phase: this.phase,
      gm: this.gm,
      seats: this.seats.map((s) => ({
        id: s.id,
        name: s.name,
        kind: s.kind,
        ...(s.level ? { level: s.level } : {}),
        ready: s.kind === 'bot' || s.id === this.gm || s.ready,
        connected: s.kind === 'bot' || s.conn !== null,
        away: s.away,
      })),
      rules: this.rules,
      spectators: [...this.conns.values()].filter((c) => c.welcomed && c.seat === null).length,
    };
  }

  // ------------------------------------------------------------ adapter entry points

  connect(conn: ConnId): void {
    if (this.closed) {
      this.opts.send(conn, { t: 'closed', reason: 'notFound' });
      this.opts.drop(conn);
      return;
    }
    this.conns.set(conn, { id: conn, seat: null, welcomed: false, sent: 0 });
  }

  /** A parsed message (null when it did not parse: refused). */
  receive(conn: ConnId, msg: ClientMessage | null): void {
    const c = this.conns.get(conn);
    if (!c || this.closed) return;
    if (!msg) {
      this.refuse(c, 'message', 'invalid');
      return;
    }
    this.touch();
    if (msg.t === 'ping') {
      this.opts.send(conn, { t: 'pong' });
      return;
    }
    if (msg.t === 'hello') {
      this.hello(c, msg);
      return;
    }
    if (!c.welcomed) {
      this.refuse(c, msg.t, 'noHello');
      return;
    }
    if (msg.t === 'leave') {
      this.leave(c);
      return;
    }
    const seat = c.seat === null ? null : this.seat(c.seat);
    if (!seat) {
      this.refuse(c, msg.t, 'spectator');
      return;
    }
    switch (msg.t) {
      case 'setName':
        if (this.phase !== 'lobby') {
          this.refuse(c, msg.t, 'notInLobby');
          return;
        }
        seat.name = msg.name;
        this.broadcastLobby();
        return;
      case 'ready':
        if (this.phase !== 'lobby') {
          this.refuse(c, msg.t, 'notInLobby');
          return;
        }
        seat.ready = msg.ready;
        this.broadcastLobby();
        return;
      case 'action': {
        if (this.phase !== 'playing' || !this.table) {
          this.refuse(c, msg.t, 'notPlaying');
          return;
        }
        const r = this.table.submit({ ...msg.action, by: seat.id });
        if (!r.ok) this.refuse(c, msg.t, r.error);
        return;
      }
      case 'continue':
        this.table?.continue(seat.id);
        return;
      default:
        this.gmMessage(c, seat, msg);
        return;
    }
  }

  disconnect(conn: ConnId): void {
    const c = this.conns.get(conn);
    if (!c || this.closed) return;
    this.conns.delete(conn);
    const seat = c.seat === null ? null : this.seat(c.seat);
    if (seat && seat.conn === conn) {
      seat.conn = null;
      seat.awayTimer = this.scheduler.setTimeout(() => {
        seat.awayTimer = null;
        this.setAway(seat, true);
        this.broadcastLobby();
      }, this.opts.awayMs ?? DEFAULT_AWAY_MS);
    }
    if (this.closeIfDone()) return;
    if (c.welcomed) this.broadcastLobby();
  }

  /** Stops every timer; the adapter calls it when it shuts down. */
  dispose(): void {
    this.close('expired');
  }

  // ------------------------------------------------------------ messages

  private hello(c: Conn, msg: Extract<ClientMessage, { t: 'hello' }>): void {
    if (msg.v !== PROTOCOL_VERSION) {
      this.end(c, 'version');
      return;
    }
    if (c.welcomed) {
      this.refuse(c, 'hello', 'already');
      return;
    }
    const back = msg.token ? this.seats.find((s) => s.token === msg.token) : undefined;
    if (back) {
      if (back.conn !== null) {
        const old = this.conns.get(back.conn);
        if (old) {
          this.conns.delete(old.id);
          this.end(old, 'replaced');
        }
      }
      back.conn = c.id;
      if (back.awayTimer !== null) this.scheduler.clearTimeout(back.awayTimer);
      back.awayTimer = null;
      this.setAway(back, false);
      this.welcome(c, back);
      return;
    }
    const canSit = this.phase === 'lobby' && !msg.spectate;
    if (canSit && this.seats.length >= MAX_PLAYERS) {
      this.end(c, 'full');
      return;
    }
    if (canSit) {
      if (!msg.name) {
        this.refuse(c, 'hello', 'name');
        return;
      }
      const seat: Seat = {
        id: this.nextSeatId(),
        name: msg.name,
        kind: 'human',
        token: this.token(),
        ready: false,
        conn: c.id,
        away: false,
        awayTimer: null,
      };
      this.seats.push(seat);
      if (this.gm === null) this.gm = seat.id;
      this.welcome(c, seat);
      return;
    }
    if (this.lobby().spectators >= MAX_SPECTATORS) {
      this.end(c, 'full');
      return;
    }
    this.welcome(c, null);
  }

  private welcome(c: Conn, seat: Seat | null): void {
    c.welcomed = true;
    c.seat = seat?.id ?? null;
    c.sent = 0;
    this.opts.send(c.id, {
      t: 'welcome',
      v: PROTOCOL_VERSION,
      code: this.code,
      token: seat?.token ?? '',
      seat: c.seat,
    });
    this.broadcastLobby();
    if (this.table) this.sendGame(c);
  }

  private gmMessage(c: Conn, seat: Seat, msg: ClientMessage): void {
    if (seat.id !== this.gm) {
      this.refuse(c, msg.t, 'notGameMaster');
      return;
    }
    switch (msg.t) {
      case 'setRules': {
        if (this.phase !== 'lobby') {
          this.refuse(c, msg.t, 'notInLobby');
          return;
        }
        const choice = checkRulesChoice(msg.choice);
        if (!choice) {
          this.refuse(c, msg.t, 'rules');
          return;
        }
        this.rules = choice;
        // The others agreed to other rules: they say again whether they are ready.
        for (const s of this.seats) s.ready = false;
        this.broadcastLobby();
        return;
      }
      case 'addBot': {
        if (this.phase !== 'lobby') {
          this.refuse(c, msg.t, 'notInLobby');
          return;
        }
        if (this.seats.length >= MAX_PLAYERS) {
          this.refuse(c, msg.t, 'full');
          return;
        }
        const id = this.nextSeatId();
        const n = this.seats.filter((s) => s.kind === 'bot').length + 1;
        this.seats.push({
          id,
          name: msg.name ?? `Bot ${n}`,
          kind: 'bot',
          level: msg.level,
          token: null,
          ready: true,
          conn: null,
          away: false,
          awayTimer: null,
        });
        this.broadcastLobby();
        return;
      }
      case 'remove': {
        if (this.phase !== 'lobby') {
          this.refuse(c, msg.t, 'notInLobby');
          return;
        }
        const target = this.seat(msg.seat);
        if (!target || target.id === this.gm) {
          this.refuse(c, msg.t, 'seat');
          return;
        }
        this.removeSeat(target);
        if (target.conn !== null) {
          const gone = this.conns.get(target.conn);
          if (gone) {
            this.conns.delete(gone.id);
            this.end(gone, 'kicked');
          }
        }
        this.broadcastLobby();
        return;
      }
      case 'start':
        this.start(c);
        return;
      case 'replay': {
        if (this.phase !== 'over') {
          this.refuse(c, msg.t, 'notOver');
          return;
        }
        this.stopTable();
        this.phase = 'lobby';
        for (const s of this.seats.filter((s) => s.kind === 'human' && s.token === null)) this.removeSeat(s);
        for (const s of this.seats) s.ready = false;
        for (const conn of this.conns.values()) conn.sent = 0;
        this.broadcastLobby();
        return;
      }
      default:
        this.refuse(c, msg.t, 'unknown');
        return;
    }
  }

  private start(c: Conn): void {
    if (this.phase !== 'lobby') {
      this.refuse(c, 'start', 'notInLobby');
      return;
    }
    if (this.seats.length < MIN_PLAYERS) {
      this.refuse(c, 'start', 'tooFew');
      return;
    }
    if (this.seats.some((s) => s.kind === 'human' && s.id !== this.gm && !s.ready && !s.away)) {
      this.refuse(c, 'start', 'notReady');
      return;
    }
    let table: Table;
    try {
      table = new Table({
        seed: Math.floor((this.opts.random ?? Math.random)() * 2 ** 32),
        rules: rulesOf(this.rules),
        scheduler: this.scheduler,
        seats: this.seats.map((s) => ({
          id: s.id,
          name: s.name,
          kind: s.kind,
          ...(s.kind === 'bot' ? { level: s.level ?? BOT_LEVEL } : {}),
        })),
      });
    } catch {
      // Rules that cannot deal this table (too many cards per hand for the deck): the game master changes them.
      this.refuse(c, 'start', 'rules');
      return;
    }
    this.table = table;
    this.phase = 'playing';
    for (const s of this.seats) if (s.away) table.setAway(s.id, true);
    for (const conn of this.conns.values()) conn.sent = 0;
    this.unsubscribe = table.subscribe(() => this.onTableChange());
    this.broadcastLobby();
    for (const conn of this.conns.values()) if (conn.welcomed) this.sendGame(conn);
  }

  private leave(c: Conn): void {
    const seat = c.seat === null ? null : this.seat(c.seat);
    this.conns.delete(c.id);
    if (seat) {
      if (this.phase === 'lobby') this.removeSeat(seat);
      else {
        // In a game the seat stays and its bot plays on; nobody can take it back.
        seat.token = null;
        seat.conn = null;
        this.setAway(seat, true);
      }
    }
    this.end(c, 'left');
    if (!this.closeIfDone()) this.broadcastLobby();
  }

  // ------------------------------------------------------------ helpers

  private seat(id: PlayerId): Seat | undefined {
    return this.seats.find((s) => s.id === id);
  }

  private nextSeatId(): PlayerId {
    this.seatSeq += 1;
    return `s${this.seatSeq}`;
  }

  private token(): string {
    return this.opts.token ? this.opts.token() : crypto.randomUUID();
  }

  private removeSeat(seat: Seat): void {
    if (seat.awayTimer !== null) this.scheduler.clearTimeout(seat.awayTimer);
    this.seats.splice(this.seats.indexOf(seat), 1);
    if (this.gm === seat.id) this.passGameMaster();
  }

  private setAway(seat: Seat, away: boolean): void {
    if (seat.away === away) return;
    seat.away = away;
    this.table?.setAway(seat.id, away);
    if (away && this.gm === seat.id) this.passGameMaster();
  }

  /** The game master's role goes to the first human still here; it stays put when nobody is. */
  private passGameMaster(): void {
    const next = this.seats.find((s) => s.kind === 'human' && s.conn !== null && !s.away);
    if (next) this.gm = next.id;
    else if (!this.seats.some((s) => s.id === this.gm)) this.gm = null;
  }

  private onTableChange(): void {
    if (!this.table) return;
    if (this.phase === 'playing' && this.table.view(SPECTATOR).phase === 'gameOver') {
      this.phase = 'over';
      this.broadcastLobby();
    }
    for (const conn of this.conns.values()) if (conn.welcomed) this.sendGame(conn);
  }

  private sendGame(c: Conn): void {
    const table = this.table;
    if (!table) return;
    const seat = c.seat ?? SPECTATOR;
    const log = c.seat === null ? table.publicEvents() : table.events(seat);
    const from = c.sent;
    c.sent = log.length;
    this.opts.send(c.id, {
      t: 'game',
      game: {
        view: table.view(seat),
        from,
        events: log.slice(from),
        readyForNext: table.readyForNext(),
        drawPending: table.drawPending(),
      },
    });
  }

  private broadcastLobby(): void {
    if (this.closed) return;
    const lobby = this.lobby();
    for (const c of this.conns.values()) if (c.welcomed) this.opts.send(c.id, { t: 'lobby', lobby });
  }

  private refuse(c: Conn, about: ClientMessage['t'] | 'message', error: string): void {
    this.opts.send(c.id, { t: 'refused', about, error });
  }

  /** Tells one connection why it is closed, then closes it. */
  private end(c: Conn, reason: CloseReason): void {
    this.opts.send(c.id, { t: 'closed', reason });
    this.opts.drop(c.id);
  }

  private touch(): void {
    if (this.closed) return;
    if (this.idleTimer !== null) this.scheduler.clearTimeout(this.idleTimer);
    this.idleTimer = this.scheduler.setTimeout(() => this.close('expired'), this.opts.idleMs ?? DEFAULT_IDLE_MS);
  }

  /** A finished game nobody watches any more: the room is done. */
  private closeIfDone(): boolean {
    if (this.phase !== 'over' || this.conns.size > 0) return false;
    this.close('expired');
    return true;
  }

  private stopTable(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.table?.dispose();
    this.table = null;
  }

  private close(reason: CloseReason): void {
    if (this.closed) return;
    this.closedWith = reason;
    if (this.idleTimer !== null) this.scheduler.clearTimeout(this.idleTimer);
    for (const s of this.seats) if (s.awayTimer !== null) this.scheduler.clearTimeout(s.awayTimer);
    this.stopTable();
    for (const c of [...this.conns.values()]) this.end(c, reason);
    this.conns.clear();
    this.opts.onClose?.(reason);
  }
}
