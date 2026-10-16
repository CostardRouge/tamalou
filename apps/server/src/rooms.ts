import { type ConnId, Room, type Scheduler } from '@tamalou/room';
import { newRoomCode, parseClientMessage } from '@tamalou/shared';

// The rooms of one process: codes, connections and the bridge between a socket and its room. Only translation lives
// here; every decision is the Room's (packages/room).

export interface Socket {
  send(text: string): void;
  close(): void;
  onMessage(fn: (text: string) => void): void;
  onClose(fn: () => void): void;
}

export interface HostOptions {
  scheduler: Scheduler;
  random?: () => number;
  idleMs?: number;
  awayMs?: number;
  maxRooms: number;
}

export class RoomHost {
  private readonly rooms = new Map<string, Room>();
  private readonly sockets = new Map<ConnId, Socket>();
  private readonly opts: HostOptions;
  private connSeq = 0;

  constructor(opts: HostOptions) {
    this.opts = opts;
  }

  get size(): number {
    return this.rooms.size;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  /** A new room under a free code; null when the server holds as many as it may. */
  create(): Room | null {
    if (this.rooms.size >= this.opts.maxRooms) return null;
    let code = newRoomCode(Math.random);
    while (this.rooms.has(code)) code = newRoomCode(Math.random);
    const room = new Room({
      code,
      scheduler: this.opts.scheduler,
      send: (conn, msg) => this.sockets.get(conn)?.send(JSON.stringify(msg)),
      drop: (conn) => {
        const socket = this.sockets.get(conn);
        this.sockets.delete(conn);
        room.disconnect(conn);
        socket?.close();
      },
      onClose: () => this.rooms.delete(code),
      ...(this.opts.random ? { random: this.opts.random } : {}),
      ...(this.opts.idleMs !== undefined ? { idleMs: this.opts.idleMs } : {}),
      ...(this.opts.awayMs !== undefined ? { awayMs: this.opts.awayMs } : {}),
    });
    this.rooms.set(code, room);
    return room;
  }

  /** Connects a socket to the room with this code (a room that does not exist tells the socket so and closes it). */
  attach(code: string, socket: Socket): void {
    const room = this.rooms.get(code);
    if (!room) {
      socket.send(JSON.stringify({ t: 'closed', reason: 'notFound' }));
      socket.close();
      return;
    }
    this.connSeq += 1;
    const conn = `c${this.connSeq}`;
    this.sockets.set(conn, socket);
    room.connect(conn);
    socket.onMessage((text) => room.receive(conn, parseClientMessage(text)));
    socket.onClose(() => {
      if (this.sockets.delete(conn)) room.disconnect(conn);
    });
  }

  closeAll(): void {
    for (const room of [...this.rooms.values()]) room.dispose();
  }
}
