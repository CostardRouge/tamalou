import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { type Scheduler, systemClock } from '@tamalou/room';
import { MAX_MESSAGE_LENGTH, normalizeRoomCode, PROTOCOL_VERSION } from '@tamalou/shared';
import { WebSocket, WebSocketServer } from 'ws';
import { readHeaders } from './headers.ts';
import { RoomHost } from './rooms.ts';

// The room server for the LAN (docs/SPEC.md §5.4), the same protocol as online: a small HTTP API, one WebSocket per
// client, and the built web app served from the same address so a phone needs nothing but the local network.
//
//   GET  /api/health           → { ok, v, mode }   (the web app shows the online mode when this answers)
//   POST /api/rooms            → { code }          (a new room)
//   GET  /api/rooms/:code      → { code, phase }   or 404
//   WS   /api/rooms/:code/ws   → the room's protocol (packages/shared/src/protocol.ts)
//   GET  anything else         → a file of the web app, or its index.html

export interface ServerOptions {
  /** The built web app (apps/web/dist); without it, only the API answers. */
  staticDir?: string;
  scheduler?: Scheduler;
  /** Game seeds (tests fix them). */
  random?: () => number;
  idleMs?: number;
  awayMs?: number;
  /** Rooms held at once; creating one more is refused (503). */
  maxRooms?: number;
  /** Seconds between WebSocket pings that find dead connections. */
  heartbeatSeconds?: number;
}

export interface RunningServer {
  server: Server;
  host: RoomHost;
  /** http://host:port */
  url: string;
  close(): Promise<void>;
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
};

const ROOM_PATH = /^\/api\/rooms\/([^/]+)(\/ws)?$/;

export function startServer(port: number, hostname: string, opts: ServerOptions = {}): Promise<RunningServer> {
  const host = new RoomHost({
    scheduler: opts.scheduler ?? systemClock,
    ...(opts.random ? { random: opts.random } : {}),
    ...(opts.idleMs !== undefined ? { idleMs: opts.idleMs } : {}),
    ...(opts.awayMs !== undefined ? { awayMs: opts.awayMs } : {}),
    maxRooms: opts.maxRooms ?? 500,
  });
  const staticDir = opts.staticDir ? resolve(opts.staticDir) : null;
  // The build's response headers (its `_headers`, apps/web/build/security.ts), on every answer: pages, files, API.
  const headers = staticDir ? readHeaders(staticDir) : {};
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_LENGTH * 4 });

  const server = createServer((req, res) => {
    for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
    handle(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;
    if (path === '/api/health' && req.method === 'GET') {
      return json(res, 200, { ok: true, v: PROTOCOL_VERSION, mode: 'lan' });
    }
    if (path === '/api/rooms' && req.method === 'POST') {
      const room = host.create();
      return room ? json(res, 201, { code: room.code }) : json(res, 503, { error: 'busy' });
    }
    const m = ROOM_PATH.exec(path);
    if (m && !m[2] && req.method === 'GET') {
      const room = host.get(m[1] ?? '');
      return room
        ? json(res, 200, { code: room.code, phase: room.lobby().phase })
        : json(res, 404, { error: 'notFound' });
    }
    if (path.startsWith('/api/')) return json(res, 404, { error: 'notFound' });
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405);
      res.end();
      return;
    }
    if (!staticDir) return json(res, 404, { error: 'notFound' });
    await serveFile(staticDir, path, req, res);
  }

  server.on('upgrade', (req, socket, head) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    const m = ROOM_PATH.exec(path);
    if (!m?.[2]) {
      socket.destroy();
      return;
    }
    const code = normalizeRoomCode(m[1] ?? '') ?? '';
    wss.handleUpgrade(req, socket, head, (ws) => {
      // handleUpgrade with a callback emits no 'connection' by itself: without this line the heartbeat below never
      // saw the socket answer and ended every one at its first beat (« Connexion perdue » every 25 s).
      wss.emit('connection', ws, req);
      host.attach(code, adapt(ws));
    });
  });

  // Phones drop off networks without closing their sockets: a ping that gets no pong ends the connection.
  const alive = new WeakSet<WebSocket>();
  wss.on('connection', (ws) => {
    alive.add(ws);
    ws.on('pong', () => alive.add(ws));
  });
  const heartbeat = setInterval(
    () => {
      for (const ws of wss.clients) {
        if (!alive.has(ws)) {
          ws.terminate();
          continue;
        }
        alive.delete(ws);
        ws.ping();
      }
    },
    (opts.heartbeatSeconds ?? 25) * 1000,
  );

  return new Promise((done) => {
    server.listen(port, hostname, () => {
      const address = server.address() as AddressInfo;
      done({
        server,
        host,
        url: `http://${hostname.includes(':') ? `[${hostname}]` : hostname}:${address.port}`,
        close: () =>
          new Promise<void>((closed) => {
            clearInterval(heartbeat);
            host.closeAll();
            for (const ws of wss.clients) ws.terminate();
            wss.close();
            server.closeAllConnections();
            server.close(() => closed());
          }),
      });
    });
  });
}

/** A ws socket as the room host sees it. */
function adapt(ws: WebSocket) {
  return {
    send: (text: string) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(text);
    },
    close: () => ws.close(1000),
    onMessage: (fn: (text: string) => void) =>
      ws.on('message', (data, isBinary) => {
        if (!isBinary) fn(data.toString());
      }),
    onClose: (fn: () => void) => ws.on('close', fn),
  };
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function serveFile(root: string, path: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    decoded = '\0';
  }
  let file = normalize(join(root, decoded));
  if (decoded.includes('\0') || (file !== root && !file.startsWith(root + sep))) {
    res.writeHead(403);
    res.end();
    return;
  }
  // The headers' file is read at startup, never served: Cloudflare's asset server keeps it to itself too.
  let info = decoded === '/_headers' ? null : await stat(file).catch(() => null);
  if (decoded === '/_headers') {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  if (info?.isDirectory()) {
    file = join(file, 'index.html');
    info = await stat(file).catch(() => null);
  }
  // An address the app routes itself (no such file, no extension): the app's page.
  if (!info && !extname(path)) {
    file = join(root, 'index.html');
    info = await stat(file).catch(() => null);
  }
  if (!info?.isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  // Built assets carry a hash in their name and never change; the page and the service worker must be fresh.
  const hashed = file.includes(`${sep}assets${sep}`);
  res.writeHead(200, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'content-length': info.size,
    'cache-control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
    'x-content-type-options': 'nosniff',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(file).pipe(res);
}
