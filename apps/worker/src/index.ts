import { DurableObject } from 'cloudflare:workers';
import { Room, systemClock } from '@tamalou/room';
import { newRoomCode, normalizeRoomCode, PROTOCOL_VERSION, parseClientMessage } from '@tamalou/shared';

// The online host (docs/SPEC.md §5.3, ADR-0004): the same API as the LAN server (apps/server), on Cloudflare.
// One Durable Object per room code holds a packages/room Room in memory; the Worker only routes. Nothing is
// persisted: a room lives while its object does, and closes after two idle hours or once a finished game is empty.
//
//   GET  /api/health           → { ok, v, mode: 'online' }
//   POST /api/rooms            → { code }
//   GET  /api/rooms/:code      → { code, phase } or 404
//   WS   /api/rooms/:code/ws   → the room's protocol

interface Env {
  ROOMS: DurableObjectNamespace<RoomObject>;
  ASSETS: Fetcher;
  CREATE_LIMIT?: { limit(o: { key: string }): Promise<{ success: boolean }> };
}

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
