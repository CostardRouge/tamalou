import {
  type ClientMessage,
  type GameEvent,
  type GameUpdate,
  type LobbyView,
  PROTOCOL_VERSION,
  type ServerMessage,
} from '@tamalou/shared';
import { describe, expect, it } from 'vitest';
import { Room, type RoomOptions } from '../src/index.ts';
import { FakeClock } from './clock.ts';

/** A room with fake connections: every message it sends is kept per connection. */
function setup(opts: Partial<RoomOptions> = {}) {
  const clock = new FakeClock();
  const inbox = new Map<string, ServerMessage[]>();
  const dropped = new Set<string>();
  const closes: string[] = [];
  let tokens = 0;
  let room: Room;
  room = new Room({
    code: 'ABCDE',
    scheduler: clock,
    send: (conn, msg) => inbox.get(conn)?.push(msg),
    drop: (conn) => {
      dropped.add(conn);
      room.disconnect(conn);
    },
    onClose: (reason) => closes.push(reason),
    token: () => `tok${++tokens}`,
    random: () => 0.42,
    ...opts,
  });

  const client = (id: string) => {
    inbox.set(id, []);
    room.connect(id);
    const msgs = () => inbox.get(id) ?? [];
    const all = <T extends ServerMessage['t']>(t: T) =>
      msgs().filter((m): m is Extract<ServerMessage, { t: T }> => m.t === t);
    const c = {
      id,
      send: (msg: ClientMessage) => room.receive(id, msg),
      hello: (name?: string, extra: Partial<Extract<ClientMessage, { t: 'hello' }>> = {}) =>
        room.receive(id, { t: 'hello', v: PROTOCOL_VERSION, ...(name ? { name } : {}), ...extra }),
      all,
      last: <T extends ServerMessage['t']>(t: T) => all(t).at(-1),
      lobby: (): LobbyView => {
        const l = all('lobby').at(-1);
        if (!l) throw new Error(`${id} has no lobby`);
        return l.lobby;
      },
      game: (): GameUpdate => {
        const g = all('game').at(-1);
        if (!g) throw new Error(`${id} has no game`);
        return g.game;
      },
      /** The full log this connection rebuilt from its updates, as a client does. */
      log: (): GameEvent[] => {
        let log: GameEvent[] = [];
        for (const m of all('game')) log = [...log.slice(0, m.game.from), ...m.game.events];
        return log;
      },
      token: () => c.last('welcome')?.token ?? '',
      seat: () => c.last('welcome')?.seat ?? null,
      closed: () => c.last('closed')?.reason ?? null,
      dropped: () => dropped.has(id),
      disconnect: () => room.disconnect(id),
    };
    return c;
  };
  return { room: () => room, clock, client, closes };
}

/** A lobby of two humans and the game master's bot, the second human ready. */
function lobbyOfThree() {
  const s = setup();
  const gm = s.client('a');
  gm.hello('Alice');
  const bob = s.client('b');
  bob.hello('Bob');
  gm.send({ t: 'addBot', level: 'easy', name: 'Robot' });
  bob.send({ t: 'ready', ready: true });
  return { ...s, gm, bob };
}

describe('room lobby', () => {
  it('seats the first player as game master and lists everyone', () => {
    const { gm, bob } = lobbyOfThree();
    expect(gm.last('welcome')).toEqual({ t: 'welcome', v: PROTOCOL_VERSION, code: 'ABCDE', token: 'tok1', seat: 's1' });
    expect(bob.seat()).toBe('s2');
    const lobby = bob.lobby();
    expect(lobby).toMatchObject({ code: 'ABCDE', phase: 'lobby', gm: 's1', spectators: 0 });
    expect(lobby.seats.map((s) => [s.name, s.kind, s.ready, s.connected])).toEqual([
      ['Alice', 'human', true, true],
      ['Bob', 'human', true, true],
      ['Robot', 'bot', true, true],
    ]);
  });

  it('refuses a client of another version, a nameless player and messages before hello', () => {
    const s = setup();
    const old = s.client('old');
    old.send({ t: 'hello', v: PROTOCOL_VERSION + 1, name: 'X' });
    expect(old.closed()).toBe('version');
    const c = s.client('c');
    c.send({ t: 'ready', ready: true });
    expect(c.last('refused')).toMatchObject({ about: 'ready', error: 'noHello' });
    c.hello();
    expect(c.last('refused')).toMatchObject({ about: 'hello', error: 'name' });
    c.hello('Chloé');
    c.hello('Chloé');
    expect(c.last('refused')).toMatchObject({ about: 'hello', error: 'already' });
    s.room().receive('c', null);
    expect(c.last('refused')).toMatchObject({ about: 'message', error: 'invalid' });
    c.send({ t: 'ping' });
    expect(c.last('pong')).toBeTruthy();
  });

  it('keeps the game master controls for the game master', () => {
    const { gm, bob } = lobbyOfThree();
    for (const msg of [
      { t: 'addBot', level: 'hard' },
      { t: 'start' },
      { t: 'remove', seat: 's1' },
      { t: 'replay' },
    ] as ClientMessage[]) {
      bob.send(msg);
      expect(bob.last('refused')).toMatchObject({ about: msg.t, error: 'notGameMaster' });
    }
    gm.send({ t: 'remove', seat: 's1' });
    expect(gm.last('refused')).toMatchObject({ error: 'seat' });
    gm.send({ t: 'replay' });
    expect(gm.last('refused')).toMatchObject({ error: 'notOver' });
  });

  it('changes the rules, checked, and asks everyone to be ready again', () => {
    const { gm, bob } = lobbyOfThree();
    gm.send({ t: 'setRules', choice: { preset: 'nope', overrides: {} } });
    expect(gm.last('refused')).toMatchObject({ about: 'setRules', error: 'rules' });
    gm.send({ t: 'setRules', choice: { preset: 'classic', overrides: { hand: { size: 99 } } } });
    expect(gm.last('refused')).toMatchObject({ error: 'rules' });
    gm.send({ t: 'setRules', choice: { preset: 'quick', overrides: { pace: { turnTimerSeconds: 30 }, junk: 1 } } });
    expect(bob.lobby().rules).toEqual({ preset: 'quick', overrides: { pace: { turnTimerSeconds: 30 } } });
    expect(bob.lobby().seats.find((s) => s.id === 's2')?.ready).toBe(false);
    bob.send({ t: 'setName', name: 'Bobby' });
    expect(gm.lobby().seats[1]?.name).toBe('Bobby');
  });

  it('starts only with two seats and every other human ready', () => {
    const s = setup();
    const gm = s.client('a');
    gm.hello('Alice');
    gm.send({ t: 'start' });
    expect(gm.last('refused')).toMatchObject({ error: 'tooFew' });
    const bob = s.client('b');
    bob.hello('Bob');
    gm.send({ t: 'start' });
    expect(gm.last('refused')).toMatchObject({ error: 'notReady' });
    bob.send({ t: 'ready', ready: true });
    for (let i = 0; i < 4; i++) gm.send({ t: 'addBot', level: 'easy' });
    expect(
      gm
        .lobby()
        .seats.map((x) => x.name)
        .slice(2),
    ).toEqual(['Bot 1', 'Bot 2', 'Bot 3', 'Bot 4']);
    gm.send({ t: 'addBot', level: 'easy' });
    expect(gm.last('refused')).toMatchObject({ about: 'addBot', error: 'full' });
    gm.send({ t: 'start' });
    expect(gm.lobby().phase).toBe('playing');
    gm.send({ t: 'start' });
    expect(gm.last('refused')).toMatchObject({ about: 'start', error: 'notInLobby' });
  });

  it('turns away a seventh player but lets them watch', () => {
    const s = setup();
    const gm = s.client('a');
    gm.hello('Alice');
    for (let i = 0; i < 5; i++) gm.send({ t: 'addBot', level: 'easy' });
    const late = s.client('late');
    late.hello('Zoé');
    expect(late.closed()).toBe('full');
    const fan = s.client('fan');
    fan.hello(undefined, { spectate: true });
    expect(fan.seat()).toBeNull();
    expect(gm.lobby().spectators).toBe(1);
  });

  it('shows a removed player the door and forgets their token', () => {
    const { gm, bob, client } = lobbyOfThree();
    gm.send({ t: 'remove', seat: 's2' });
    expect(bob.closed()).toBe('kicked');
    expect(bob.dropped()).toBe(true);
    expect(gm.lobby().seats.map((s) => s.id)).toEqual(['s1', 's3']);
    gm.send({ t: 'remove', seat: 's3' });
    expect(gm.lobby().seats).toHaveLength(1);
    const again = client('b2');
    again.hello('Bob', { token: 'tok2' });
    expect(again.seat()).toBe('s4');
  });

  it('frees a seat left in the lobby and passes the game master role on', () => {
    const { gm, bob } = lobbyOfThree();
    gm.send({ t: 'leave' });
    expect(gm.closed()).toBe('left');
    expect(bob.lobby()).toMatchObject({ gm: 's2' });
    expect(bob.lobby().seats.map((s) => s.id)).toEqual(['s2', 's3']);
  });
});

describe('room game', () => {
  const started = () => {
    const s = lobbyOfThree();
    s.gm.send({ t: 'start' });
    return s;
  };

  it('deals and sends each seat its own view and private events only', () => {
    const { gm, bob } = started();
    expect(gm.lobby().phase).toBe('playing');
    expect(gm.game().view.me).toBe('s1');
    expect(bob.game().view.me).toBe('s2');
    const peeks = (log: GameEvent[]) =>
      log.filter((e) => e.type === 'initialPeek').map((e) => (e as { to: string }).to);
    expect(peeks(gm.log())).toEqual(['s1']);
    expect(peeks(bob.log())).toEqual(['s2']);
  });

  it("plays an action for the sender's seat only, and says why one is refused", () => {
    const { gm, bob } = started();
    bob.send({ t: 'action', action: { type: 'ready' } });
    expect(gm.game().view.ready).toContain('s2');
    expect(gm.game().view.ready).not.toContain('s1');
    bob.send({ t: 'action', action: { type: 'swap', slot: 0 } });
    expect(bob.last('refused')).toMatchObject({ about: 'action' });
    bob.send({ t: 'ready', ready: false });
    expect(bob.last('refused')).toMatchObject({ error: 'notInLobby' });
  });

  it('lets a latecomer watch with the public view and the public log', () => {
    const { client, gm } = started();
    gm.send({ t: 'action', action: { type: 'ready' } });
    const fan = client('fan');
    fan.hello('Fan');
    expect(fan.seat()).toBeNull();
    expect(fan.game().view.me).toBe('@table');
    expect(fan.log().some((e) => 'to' in e)).toBe(false);
    expect(fan.log().length).toBeGreaterThan(0);
    fan.send({ t: 'action', action: { type: 'ready' } });
    expect(fan.last('refused')).toMatchObject({ error: 'spectator' });
  });

  it('marks a lost player away after a delay, plays for them, and gives the seat back with the whole log', () => {
    const { gm, bob, clock, client } = started();
    gm.send({ t: 'action', action: { type: 'ready' } });
    bob.disconnect();
    expect(gm.lobby().seats[1]).toMatchObject({ connected: false, away: false });
    // The game master did not hand their role over: they are still here.
    clock.advance(30_000);
    expect(gm.lobby().seats[1]).toMatchObject({ connected: false, away: true });
    clock.advance(2000);
    // Bob's stand-in did his initial peek; the game goes on.
    expect(gm.game().view.ready).toContain('s2');
    const back = client('b-again');
    back.hello(undefined, { token: bob.token() });
    expect(back.seat()).toBe('s2');
    expect(back.game().from).toBe(0);
    expect(back.log().filter((e) => e.type === 'initialPeek')).toHaveLength(1);
    expect(gm.lobby().seats[1]).toMatchObject({ connected: true, away: false });
  });

  it('closes the older connection of a seat opened twice', () => {
    const { bob, client } = started();
    const twin = client('b2');
    twin.hello(undefined, { token: bob.token() });
    expect(bob.closed()).toBe('replaced');
    expect(twin.seat()).toBe('s2');
  });

  it('hands the game master role to someone present when the game master is away', () => {
    const { gm, bob, clock } = started();
    gm.disconnect();
    clock.advance(30_000);
    expect(bob.lobby().gm).toBe('s2');
  });

  it('reaches the end, replays with the same players and rules, and closes once everyone is gone', () => {
    const s = setup();
    const gm = s.client('a');
    gm.hello('Alice');
    gm.send({ t: 'setRules', choice: { preset: 'classic', overrides: { gameEnd: { mode: 'rounds', rounds: 1 } } } });
    gm.send({ t: 'addBot', level: 'hard' });
    const bob = s.client('b');
    bob.hello('Bob');
    bob.send({ t: 'ready', ready: true });
    gm.send({ t: 'start' });
    // Both humans leave the playing to their stand-ins: one leaves for good, one loses the connection.
    bob.send({ t: 'leave' });
    gm.disconnect();
    for (let i = 0; i < 600 && gm.lobby().phase !== 'over'; i++) s.clock.advance(1000);
    const back = s.client('a2');
    back.hello(undefined, { token: gm.token() });
    expect(back.lobby().phase).toBe('over');
    expect(back.game().view.phase).toBe('gameOver');
    back.send({ t: 'replay' });
    expect(back.lobby()).toMatchObject({ phase: 'lobby', rules: { overrides: { gameEnd: { rounds: 1 } } } });
    // Bob left for good: his seat is gone; the bot stays.
    expect(back.lobby().seats.map((x) => x.kind)).toEqual(['human', 'bot']);
    back.send({ t: 'start' });
    for (let i = 0; i < 600 && back.lobby().phase !== 'over'; i++) {
      const v = back.game().view;
      if (v.phase === 'initialPeek' && !v.ready.includes('s1')) back.send({ t: 'action', action: { type: 'ready' } });
      if (v.phase === 'play' && v.current === 's1') {
        back.send({ t: 'action', action: v.step === 'draw' ? { type: 'callTamalou' } : { type: 'discardDrawn' } });
      }
      s.clock.advance(1000);
    }
    expect(back.lobby().phase).toBe('over');
    back.disconnect();
    expect(s.room().closed).toBe(true);
    expect(s.closes).toEqual(['expired']);
  });
});

describe('room lifetime', () => {
  it('closes after two idle hours, telling everyone', () => {
    const { gm, bob, clock, closes, room } = lobbyOfThree();
    clock.advance(60 * 60 * 1000);
    bob.send({ t: 'ping' });
    clock.advance(60 * 60 * 1000);
    expect(room().closed).toBe(false);
    clock.advance(60 * 60 * 1000);
    expect(gm.closed()).toBe('expired');
    expect(bob.dropped()).toBe(true);
    expect(closes).toEqual(['expired']);
    expect(clock.pending()).toBe(0);
  });

  it('turns away a connection to a closed room', () => {
    const s = setup();
    s.room().dispose();
    const c = s.client('c');
    expect(c.closed()).toBe('notFound');
  });
});
