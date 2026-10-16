// @vitest-environment jsdom
import { Room } from '@tamalou/room';
import { parseClientMessage, type ServerMessage } from '@tamalou/shared';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RemoteConnection, RoomClient, savedToken, saveToken } from '../src/connection/remote.ts';
import { OnlineScreen } from '../src/online/OnlineScreen.tsx';

// The online client against a real Room, through fake sockets delivered on microtasks: what a phone does with the
// server, without a network.

/** A clock that never fires: these tests do not wait for bots or expiry. */
const stillClock = { now: () => 0, setTimeout: () => 0, clearTimeout: () => {} };

class FakeSocket {
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  readonly id: string;
  private readonly server: Server;
  constructor(id: string, server: Server) {
    this.id = id;
    this.server = server;
  }
  send(text: string) {
    if (this.readyState === 1) this.server.room.receive(this.id, parseClientMessage(text));
  }
  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.server.sockets.delete(this.id);
    this.server.room.disconnect(this.id);
    queueMicrotask(() => this.onclose?.());
  }
}

class Server {
  readonly sockets = new Map<string, FakeSocket>();
  readonly room: Room;
  private seq = 0;
  constructor(code = 'ABCDE') {
    this.room = new Room({
      code,
      scheduler: stillClock,
      send: (conn, msg: ServerMessage) => {
        const s = this.sockets.get(conn);
        queueMicrotask(() => s?.onmessage?.({ data: JSON.stringify(msg) }));
      },
      drop: (conn) => queueMicrotask(() => this.sockets.get(conn)?.close()),
    });
  }
  /** The factory a RoomClient opens sockets with. */
  open = () => {
    this.seq += 1;
    const s = new FakeSocket(`c${this.seq}`, this);
    this.sockets.set(s.id, s);
    queueMicrotask(() => {
      this.room.connect(s.id);
      s.readyState = 1;
      s.onopen?.();
    });
    return s as unknown as WebSocket;
  };
}

/** Lets the microtask chain of a few round trips run. */
const flush = async () => {
  for (let i = 0; i < 10; i++) await act(async () => {});
};

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('the room client', () => {
  it('keeps its token, rebuilds the log and comes back to its seat after a dropped socket', async () => {
    const server = new Server();
    const a = new RoomClient({ code: 'ABCDE', name: 'Alice' }, server.open);
    const b = new RoomClient({ code: 'ABCDE', name: 'Bob' }, server.open);
    await flush();
    expect(a.seat).toBe('s1');
    expect(a.isGameMaster).toBe(true);
    expect(savedToken('ABCDE')).toBeTruthy();
    b.send({ t: 'ready', ready: true });
    a.send({ t: 'start' });
    await flush();
    const conn = new RemoteConnection(a);
    expect(conn.me).toBe('s1');
    expect(conn.view().phase).toBe('initialPeek');
    expect(conn.events().some((e) => e.type === 'initialPeek')).toBe(true);
    expect(conn.rules.hand.size).toBe(4);
    expect(conn.send({ type: 'ready', by: 'someone else' })).toEqual({ ok: true });
    await flush();
    expect(conn.view().ready).toEqual(['s1']);
    expect(conn.presence('s2')).toBeNull();
    // Bob's socket drops; his client reconnects with his token on its own (first retry after a second).
    const before = b.game?.log.length ?? 0;
    for (const s of server.sockets.values()) if (s.id === 'c2') s.close();
    await flush();
    expect(b.status).toBe('reconnecting');
    expect(conn.presence('s2')).toBe('offline');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1100));
    });
    await flush();
    expect(b.status).toBe('open');
    expect(b.seat).toBe('s2');
    expect(b.game?.log.length).toBeGreaterThanOrEqual(before);
    a.dispose();
    b.dispose();
  });

  it('stops for good when the room is gone, and forgets the token', async () => {
    const server = new Server();
    server.room.dispose();
    saveToken('ABCDE', 'old');
    const c = new RoomClient({ code: 'ABCDE' }, server.open);
    await flush();
    expect(c.status).toBe('closed');
    expect(c.closedReason).toBe('notFound');
    expect(savedToken('ABCDE')).toBeNull();
    expect(c.send({ t: 'ping' })).toBe(false);
  });
});

describe('the online screens', () => {
  it('asks a name before sitting at a room opened from a link', async () => {
    const server = new Server();
    render(<OnlineScreen code="ABCDE" onExit={() => {}} socket={server.open} />);
    expect(screen.getByText('Salle ABCDE')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Ton prénom'), { target: { value: 'Léa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rejoindre' }));
    await flush();
    expect(screen.getByText('Léa')).toBeTruthy();
    expect(screen.getByText('Maître de jeu')).toBeTruthy();
  });

  it('lets the game master add a bot and start; the game screen follows', async () => {
    const server = new Server();
    render(<OnlineScreen code="ABCDE" name="Alice" onExit={() => {}} socket={server.open} />);
    await flush();
    expect(screen.getByText('Joueurs (1/6)')).toBeTruthy();
    const start = screen.getByRole('button', { name: 'Lancer la partie' }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    expect(screen.getByRole('img', { name: 'QR code du lien de la salle' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un bot' }));
    await flush();
    expect(screen.getByText('Ada')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Lancer la partie' }));
    await flush();
    expect(screen.getByText('Mémorise tes 2 cartes, elles vont se retourner.')).toBeTruthy();
  });

  it('tells a player the room does not exist', async () => {
    const server = new Server();
    server.room.dispose();
    let left = false;
    render(<OnlineScreen code="ABCDE" name="Alice" onExit={() => (left = true)} socket={server.open} />);
    await flush();
    expect(screen.getByText('Cette salle n’existe pas ou n’existe plus.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(left).toBe(true);
  });
});
