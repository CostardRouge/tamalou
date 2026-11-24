import { DurableObject } from 'cloudflare:workers';
import { Room, systemClock } from '@tamalou/room';
import {
  MAX_USAGE_REPORT,
  newRoomCode,
  normalizeRoomCode,
  PROTOCOL_VERSION,
  parseClientMessage,
  parseUsageReport,
  type UsageRow,
  usageCutoff,
  usageDay,
  usageMinute,
} from '@tamalou/shared';
import { type AdminEnv, admin } from './admin.ts';

// The online host (docs/SPEC.md §5.3, ADR-0004): the same API as the LAN server (apps/server), on Cloudflare.
// One Durable Object per room code holds a packages/room Room in memory; the Worker only routes. A room is never
// persisted: it lives while its object does, and closes after two idle hours or once a finished game is empty. The one
// thing kept is the anonymous usage statistics (ADR-0024), in one SQLite-backed object, read by the admin page.
//
//   GET  /api/health           → { ok, v, mode: 'online' }
//   POST /api/rooms            → { code }
//   GET  /api/rooms/:code      → { code, phase } or 404
//   WS   /api/rooms/:code/ws   → the room's protocol
//   POST /api/usage            → 204: one anonymous usage report (packages/shared usage.ts)
//   /admin/…                   → the owner's statistics, signed in through Sésame (admin.ts)

type Limit = { limit(o: { key: string }): Promise<{ success: boolean }> };

interface Env extends AdminEnv {
  ROOMS: DurableObjectNamespace<RoomObject>;
  USAGE: DurableObjectNamespace<UsageObject>;
  ASSETS: Fetcher;
  CREATE_LIMIT?: Limit;
  USAGE_LIMIT?: Limit;
}

/** The one object holding the statistics. */
const usageStore = (env: Env) => env.USAGE.get(env.USAGE.idFromName('usage'));

const ROOM_PATH = /^\/api\/rooms\/([^/]+)(\/ws)?$/;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === '/api/health' && request.method === 'GET')
      return json(200, { ok: true, v: PROTOCOL_VERSION, mode: 'online' });
    if (path === '/admin' || path.startsWith('/admin/')) return admin(request, env, usageStore(env));
    if (path === '/api/usage' && request.method === 'POST') {
      const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
      if (env.USAGE_LIMIT && !(await env.USAGE_LIMIT.limit({ key: ip })).success)
        return new Response(null, { status: 429 });
      const text = await request.text();
      if (text.length > MAX_USAGE_REPORT) return new Response(null, { status: 413 });
      let report: ReturnType<typeof parseUsageReport> = null;
      try {
        report = parseUsageReport(JSON.parse(text));
      } catch {
        report = null;
      }
      if (!report) return new Response(null, { status: 400 });
      // Only the day and the minute are added: no address, no browser.
      const now = new Date();
      await usageStore(env).record(usageDay(now), usageMinute(now), JSON.stringify(report));
      return new Response(null, { status: 204 });
    }
    if (path === '/api/rooms' && request.method === 'POST') {
      const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
      if (env.CREATE_LIMIT && !(await env.CREATE_LIMIT.limit({ key: ip })).success)
        return json(429, { error: 'slowDown' });
      // A code already in use is drawn again; with 32^5 codes a second draw is rare, a sixth unheard of.
      for (let i = 0; i < 6; i++) {
        const code = newRoomCode(Math.random);
        if (await env.ROOMS.get(env.ROOMS.idFromName(code)).open(code)) return json(201, { code });
      }
      return json(503, { error: 'busy' });
    }
    const m = ROOM_PATH.exec(path);
    if (m) {
      const code = normalizeRoomCode(m[1] ?? '');
      if (!code) return m[2] ? notFoundSocket() : json(404, { error: 'notFound' });
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      if (m[2]) {
        if (request.headers.get('upgrade') !== 'websocket') return json(426, { error: 'upgrade' });
        return stub.fetch(request);
      }
      if (request.method !== 'GET') return json(405, { error: 'method' });
      const phase = await stub.phase();
      return phase ? json(200, { code, phase }) : json(404, { error: 'notFound' });
    }
    if (path.startsWith('/api/')) return json(404, { error: 'notFound' });
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

/** A socket for a room that cannot exist: it hears why and closes, as the room itself would say. */
function notFoundSocket(): Response {
  const { 0: client, 1: server } = new WebSocketPair();
  server.accept();
  server.send(JSON.stringify({ t: 'closed', reason: 'notFound' }));
  server.close(1000);
  return new Response(null, { status: 101, webSocket: client });
}

export class RoomObject extends DurableObject<Env> {
  private room: Room | null = null;
  private readonly sockets = new Map<string, WebSocket>();
  private seq = 0;

  /** Opens the room under this code; false when one is already open here. */
  async open(code: string): Promise<boolean> {
    if (this.room && !this.room.closed) return false;
    this.room = new Room({
      code,
      scheduler: systemClock,
      send: (conn, msg) => {
        try {
          this.sockets.get(conn)?.send(JSON.stringify(msg));
        } catch {
          // The socket is closing: its close event tells the room.
        }
      },
      drop: (conn) => {
        const ws = this.sockets.get(conn);
        this.sockets.delete(conn);
        this.room?.disconnect(conn);
        try {
          ws?.close(1000);
        } catch {
          // Already closed.
        }
      },
      onClose: () => {
        this.room = null;
      },
    });
    return true;
  }

  async phase(): Promise<string | null> {
    return this.room && !this.room.closed ? this.room.lobby().phase : null;
  }

  override async fetch(_request: Request): Promise<Response> {
    const { 0: client, 1: server } = new WebSocketPair();
    // Accepted the plain way, not hibernated: the room and its timers live in this object's memory.
    server.accept();
    const room = this.room;
    if (!room || room.closed) {
      server.send(JSON.stringify({ t: 'closed', reason: 'notFound' }));
      server.close(1000);
      return new Response(null, { status: 101, webSocket: client });
    }
    this.seq += 1;
    const conn = `c${this.seq}`;
    this.sockets.set(conn, server);
    room.connect(conn);
    server.addEventListener('message', (e) => {
      if (typeof e.data === 'string') room.receive(conn, parseClientMessage(e.data));
    });
    const gone = () => {
      if (this.sockets.delete(conn)) room.disconnect(conn);
    };
    server.addEventListener('close', gone);
    server.addEventListener('error', gone);
    return new Response(null, { status: 101, webSocket: client });
  }
}

/**
 * The anonymous usage statistics (ADR-0024): one row per report, its day and its JSON, in this object's SQLite.
 * Rows older than 13 months are deleted, at most once a day, when a report comes in.
 */
export class UsageObject extends DurableObject<Env> {
  private pruned = '';

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS usage (day TEXT NOT NULL, report TEXT NOT NULL)');
    ctx.storage.sql.exec('CREATE INDEX IF NOT EXISTS usage_day ON usage (day)');
    // The minute a report came (2026-11-24): rows kept before have none.
    const columns = [...ctx.storage.sql.exec<{ name: string }>('PRAGMA table_info(usage)')].map((c) => c.name);
    if (!columns.includes('at')) ctx.storage.sql.exec('ALTER TABLE usage ADD COLUMN at TEXT');
  }

  async record(day: string, at: string, report: string): Promise<void> {
    this.ctx.storage.sql.exec('INSERT INTO usage (day, at, report) VALUES (?, ?, ?)', day, at, report);
    if (this.pruned !== day) {
      this.pruned = day;
      this.ctx.storage.sql.exec('DELETE FROM usage WHERE day < ?', usageCutoff(day));
    }
  }

  async rows(since: string): Promise<UsageRow[]> {
    const out: UsageRow[] = [];
    for (const r of this.ctx.storage.sql.exec<{ day: string; at: string | null; report: string }>(
      'SELECT day, at, report FROM usage WHERE day >= ? ORDER BY day, at',
      since,
    )) {
      try {
        const report = parseUsageReport(JSON.parse(r.report));
        if (report) out.push(r.at ? { day: r.day, at: r.at, report } : { day: r.day, report });
      } catch {
        // A row that no longer reads is skipped.
      }
    }
    return out;
  }
}
