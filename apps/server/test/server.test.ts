import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGame } from '@tamalou/engine';
import {
  type ClientMessage,
  type GameUpdate,
  type LobbyView,
  PROTOCOL_VERSION,
  rulesOf,
  type ServerMessage,
} from '@tamalou/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { parseHeadersFile } from '../src/headers.ts';
import { type RunningServer, startServer } from '../src/index.ts';

// Real sockets against a real server on a free port: what the LAN mode runs, and the online one through the same Room.

let running: RunningServer | null = null;
afterEach(async () => {
  await running?.close();
  running = null;
});

async function serve(opts: Parameters<typeof startServer>[2] = {}) {
  running = await startServer(0, '127.0.0.1', { heartbeatSeconds: 3600, ...opts });
  return running;
}

/** A client that keeps every message and can wait for the next one matching a test. */
class Client {
  readonly msgs: ServerMessage[] = [];
  private waiters: { test: (m: ServerMessage) => boolean; done: (m: ServerMessage) => void }[] = [];
  readonly ws: WebSocket;
  readonly opened: Promise<void>;
  readonly closed: Promise<void>;

  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.opened = new Promise((ok, ko) => {
      this.ws.once('open', () => ok());
      this.ws.once('error', ko);
    });
    this.closed = new Promise((ok) => this.ws.once('close', () => ok()));
    this.ws.on('message', (data) => {
      const msg = JSON.parse(data.toString()) as ServerMessage;
      this.msgs.push(msg);
      this.waiters = this.waiters.filter((w) => {
        if (!w.test(msg)) return true;
        w.done(msg);
        return false;
      });
    });
  }

  send(msg: ClientMessage | string) {
    this.ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  /** The first message (already received or to come) after `skip` messages that passes the test. */
  next<T extends ServerMessage['t']>(t: T, test: (m: Extract<ServerMessage, { t: T }>) => boolean = () => true) {
    const ok = (m: ServerMessage): m is Extract<ServerMessage, { t: T }> => m.t === t && test(m as never);
    const seen = this.msgs.find(ok);
    if (seen) return Promise.resolve(seen);
    return new Promise<Extract<ServerMessage, { t: T }>>((done, fail) => {
      const timer = setTimeout(() => fail(new Error(`no ${t} message`)), 3000);
      this.waiters.push({
        test: ok,
        done: (m) => {
          clearTimeout(timer);
          done(m as Extract<ServerMessage, { t: T }>);
        },
      });
    });
  }

  lobby(test: (l: LobbyView) => boolean = () => true) {
    return this.next('lobby', (m) => test(m.lobby)).then((m) => m.lobby);
  }

  game(test: (g: GameUpdate) => boolean = () => true) {
    return this.next('game', (m) => test(m.game)).then((m) => m.game);
  }

  /** Forgets what was received, so the next wait only sees new messages. */
  clear() {
    this.msgs.length = 0;
  }
}

async function enter(base: string, code: string, hello: Partial<Extract<ClientMessage, { t: 'hello' }>>) {
  const c = new Client(`${base.replace('http', 'ws')}/api/rooms/${code}/ws`);
  await c.opened;
  c.send({ t: 'hello', v: PROTOCOL_VERSION, ...hello });
  return c;
}

const createRoom = async (base: string) => {
  const res = await fetch(`${base}/api/rooms`, { method: 'POST' });
  expect(res.status).toBe(201);
  return ((await res.json()) as { code: string }).code;
};

describe('LAN server HTTP', () => {
  it('answers health, creates rooms and finds them', async () => {
    const { url } = await serve();
    expect(await (await fetch(`${url}/api/health`)).json()).toEqual({ ok: true, v: PROTOCOL_VERSION, mode: 'lan' });
    const code = await createRoom(url);
    expect(code).toMatch(/^[A-Z2-9]{5}$/);
    expect(await (await fetch(`${url}/api/rooms/${code}`)).json()).toEqual({ code, phase: 'lobby' });
    expect((await fetch(`${url}/api/rooms/ZZZZZ`)).status).toBe(404);
    expect((await fetch(`${url}/api/nope`)).status).toBe(404);
  });

  it('refuses rooms beyond its limit', async () => {
    const { url } = await serve({ maxRooms: 1 });
    await createRoom(url);
    expect((await fetch(`${url}/api/rooms`, { method: 'POST' })).status).toBe(503);
  });

  it('serves the web app, its routes and nothing outside it', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tamalou-web-'));
    await mkdir(join(dir, 'assets'));
    await writeFile(join(dir, 'index.html'), '<!doctype html><title>Tamalou</title>');
    await writeFile(join(dir, '404.html'), '<!doctype html><title>Page introuvable</title>');
    await writeFile(join(dir, 'assets', 'app-1234.js'), 'console.log(1)');
    const { url } = await serve({ staticDir: dir });
    const page = await fetch(`${url}/`);
    expect(page.headers.get('content-type')).toContain('text/html');
    expect(page.headers.get('cache-control')).toBe('no-cache');
    expect(await page.text()).toContain('Tamalou');
    const asset = await fetch(`${url}/assets/app-1234.js`);
    expect(asset.headers.get('cache-control')).toContain('immutable');
    // An unknown address gets the 404 page with its status, never the home page (its relative links would break).
    for (const path of ['/projects/', '/salle/ABCDE', '/missing.png', '/%2e%2e/%2e%2e/etc/passwd']) {
      const missing = await fetch(`${url}${path}`);
      expect(missing.status, path).toBe(404);
      expect(missing.headers.get('content-type'), path).toContain('text/html');
      expect(await missing.text(), path).toContain('Page introuvable');
    }
    expect((await fetch(`${url}/projects/`, { method: 'HEAD' })).status).toBe(404);
    expect((await fetch(`${url}/..%2f..%2fetc%2fpasswd`)).status).toBe(403);
    expect((await fetch(`${url}/%E0%A4%A`)).status).toBe(403);
    expect((await fetch(`${url}/`, { method: 'POST' })).status).toBe(405);
    expect((await fetch(`${url}/`, { method: 'HEAD' })).status).toBe(200);
  });

  it('sends the response headers the web build wrote in _headers, on every answer', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tamalou-web-'));
    await mkdir(join(dir, 'assets'));
    await writeFile(join(dir, 'index.html'), '<!doctype html><title>Tamalou</title>');
    await writeFile(join(dir, 'assets', 'app-1234.js'), 'console.log(1)');
    // The shape apps/web/build/security.ts writes: the `/*` block, then per-path blocks the server leaves alone.
    await writeFile(
      join(dir, '_headers'),
      [
        '/*',
        '  X-Frame-Options: DENY',
        "  Content-Security-Policy-Report-Only: default-src 'self'; frame-ancestors 'none'",
        '',
        '/assets/*',
        '  Cache-Control: public, max-age=0',
        '',
      ].join('\n'),
    );
    const { url } = await serve({ staticDir: dir });
    for (const path of ['/', '/assets/app-1234.js', '/salle/ABCDE', '/missing.png', '/api/health', '/api/nope']) {
      const res = await fetch(`${url}${path}`);
      expect(res.headers.get('x-frame-options'), path).toBe('DENY');
      expect(res.headers.get('content-security-policy-report-only'), path).toContain("frame-ancestors 'none'");
    }
    // The server's own caching wins over the file's per-path blocks, and the file itself is never served.
    expect((await fetch(`${url}/assets/app-1234.js`)).headers.get('cache-control')).toContain('immutable');
    expect((await fetch(`${url}/_headers`)).status).toBe(404);
  });

  it('reads the /* block of a _headers file and nothing else', () => {
    expect(parseHeadersFile('/*\n  A-B: one\n  C: two: three \n\n/x\n  D: four\n')).toEqual({
      'a-b': 'one',
      c: 'two: three',
    });
    expect(parseHeadersFile('/x\n  D: four\n')).toEqual({});
    expect(parseHeadersFile('')).toEqual({});
  });
});

describe('LAN server heartbeat', () => {
  // Every other test runs with a heartbeat of an hour, which is how a server that cut every socket at its first beat
  // went unseen: each player got « Connexion perdue » every 25 s. Here the beat is short and real.
  const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

  it('keeps a socket that answers pings across several beats', async () => {
    const { url } = await serve({ heartbeatSeconds: 0.05 });
    const code = await createRoom(url);
    const c = await enter(url, code, { name: 'Ana' });
    await c.lobby();
    await wait(400);
    expect(c.ws.readyState).toBe(WebSocket.OPEN);
    c.ws.close();
  });

  it('ends a socket that stops answering pings', async () => {
    const { url } = await serve({ heartbeatSeconds: 0.05 });
    const code = await createRoom(url);
    const ws = new WebSocket(`${url.replace('http', 'ws')}/api/rooms/${code}/ws`, { autoPong: false });
    const closed = new Promise<void>((done) => ws.once('close', () => done()));
    await new Promise<void>((done) => ws.once('open', () => done()));
    await closed;
    expect(ws.readyState).toBe(WebSocket.CLOSED);
  });
});

describe('LAN server rooms over WebSockets', () => {
  it('tells a socket the room does not exist', async () => {
    const { url } = await serve();
    const c = await enter(url, 'ZZZZZ', { name: 'X' });
    expect(await c.next('closed')).toEqual({ t: 'closed', reason: 'notFound' });
    await c.closed;
  });

  it('plays three phones in one room, each seeing only its own seat', async () => {
    const { url } = await serve();
    const code = await createRoom(url);
    const a = await enter(url, code, { name: 'Alice' });
    expect((await a.next('welcome')).seat).toBe('s1');
    const b = await enter(url, code, { name: 'Bob' });
    const c = await enter(url, code, { name: 'Chloé' });
    await a.lobby((l) => l.seats.length === 3);
    b.send({ t: 'ready', ready: true });
    c.send({ t: 'ready', ready: true });
    await a.lobby((l) => l.seats.every((s) => s.ready));
    a.send({ t: 'start' });
    const views = await Promise.all([a.game(), b.game(), c.game()]);
    expect(views.map((g) => g.view.me)).toEqual(['s1', 's2', 's3']);
    for (const [i, g] of views.entries()) {
      const private_ = g.events.filter((e) => 'to' in e).map((e) => (e as { to: string }).to);
      expect(new Set(private_)).toEqual(new Set([`s${i + 1}`]));
    }
    expect(((await (await fetch(`${url}/api/rooms/${code}`)).json()) as { phase: string }).phase).toBe('playing');
  });

  it('refuses garbage without closing the socket', async () => {
    const { url } = await serve();
    const code = await createRoom(url);
    const a = await enter(url, code, { name: 'Alice' });
    a.send('{"t":"hello"');
    expect(await a.next('refused')).toEqual({ t: 'refused', about: 'message', error: 'invalid' });
    a.send({ t: 'ping' });
    await a.next('pong');
  });

  it('applies the first of two simultaneous quick discards; the late one is cancelled without penalty', async () => {
    // A seed where both humans hold a card of the first discard's rank, so both claims are good ones.
    const rules = rulesOf({ preset: 'classic', overrides: {} });
    const players = [
      { id: 's1', name: 'Alice' },
      { id: 's2', name: 'Bob' },
    ];
    let seed = 1;
    let slots: [number, number] = [-1, -1];
    for (; seed < 5000; seed++) {
      const { state } = createGame({ seed, players, rules });
      const top = state.cards[state.discard.at(-1) as number]?.rank;
      const match = (p: string) => (state.hands[p] ?? []).findIndex((id) => state.cards[id as number]?.rank === top);
      slots = [match('s1'), match('s2')];
      if (slots[0] >= 0 && slots[1] >= 0) break;
    }
    expect(slots.every((s) => s >= 0)).toBe(true);

    const { url } = await serve({ random: () => seed / 2 ** 32 });
    const code = await createRoom(url);
    const a = await enter(url, code, { name: 'Alice' });
    const b = await enter(url, code, { name: 'Bob' });
    await a.lobby((l) => l.seats.length === 2);
    b.send({ t: 'ready', ready: true });
    await a.lobby((l) => l.seats.every((s) => s.ready));
    a.send({ t: 'start' });
    await a.game();
    a.send({ t: 'action', action: { type: 'ready' } });
    b.send({ t: 'action', action: { type: 'ready' } });
    const playing = await b.game((g) => g.view.phase === 'play');
    const expectTop = playing.view.discardTop?.id as number;
    a.clear();
    b.clear();
    // Sent back to back: the server takes them in arrival order.
    a.send({ t: 'action', action: { type: 'quickDiscard', target: { player: 's1', slot: slots[0] }, expectTop } });
    b.send({ t: 'action', action: { type: 'quickDiscard', target: { player: 's2', slot: slots[1] }, expectTop } });
    expect(await b.next('refused')).toEqual({ t: 'refused', about: 'action', error: 'staleTop' });
    const after = await a.game((g) => g.events.some((e) => e.type === 'quickDiscard'));
    const hand = (p: string) => after.view.players.find((x) => x.id === p)?.slots.filter((s) => s.filled).length;
    expect(hand('s1')).toBe(3);
    expect(hand('s2')).toBe(4);
    expect(a.msgs.some((m) => m.t === 'refused')).toBe(false);
  });

  it('takes a reloaded phone back to its seat with its whole log', async () => {
    const { url } = await serve({ awayMs: 50 });
    const code = await createRoom(url);
    const a = await enter(url, code, { name: 'Alice' });
    const { token } = await a.next('welcome');
    const b = await enter(url, code, { name: 'Bob' });
    await b.next('welcome');
    b.send({ t: 'ready', ready: true });
    await a.lobby((l) => l.seats.every((s) => s.ready));
    a.send({ t: 'start' });
    await b.game();
    b.ws.close();
    await a.lobby((l) => l.seats[1]?.away === true);
    const b2 = await enter(url, code, { token: (await b.next('welcome')).token });
    expect((await b2.next('welcome')).seat).toBe('s2');
    const g = await b2.game();
    expect(g.from).toBe(0);
    expect(g.events.filter((e) => e.type === 'initialPeek')).toHaveLength(1);
    await a.lobby((l) => l.seats[1]?.connected === true && l.seats[1]?.away === false);
    // The same token from a second tab takes the seat over; the first tab hears it.
    const a2 = await enter(url, code, { token });
    expect((await a.next('closed')).reason).toBe('replaced');
    expect((await a2.next('welcome')).seat).toBe('s1');
  });

  it('forgets a room once it closes', async () => {
    const { url, host } = await serve({ idleMs: 50 });
    const code = await createRoom(url);
    const a = await enter(url, code, { name: 'Alice' });
    expect((await a.next('closed')).reason).toBe('expired');
    await a.closed;
    expect(host.size).toBe(0);
    expect((await fetch(`${url}/api/rooms/${code}`)).status).toBe(404);
  });
});
