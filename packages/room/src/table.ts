import { Bot, type BotLevel, PROFILES } from '@tamalou/bots';
import { apply, createGame, type GameState, hostAction, legalActions, nextRandom, viewFor } from '@tamalou/engine';
import {
  type Action,
  type GameEvent,
  isVisibleTo,
  type PlayerId,
  type PlayerView,
  type RuleSet,
} from '@tamalou/shared';

// A game table and its host: the engine's state, the bots, and every rule that needs a clock (ADR-0008). It is the
// authority for the seats it holds: solo and pass-and-play run it in the browser (LocalConnection), and the servers
// of M6/M7 will wrap it with sockets. The clock is injected, so tests drive time by hand.
//
// What the host does that the engine cannot:
// - bots: each one decides from its own view, and its move is played after the delay its level asks for;
// - the quick-discard window's minimum (quickDiscard.minWindowMs): a draw that comes earlier is held back until then;
// - the host actions: score a finished round once its window has run, deal the next one when every human is ready;
// - the turn timer (pace.turnTimerSeconds): a human who runs out of time has their turn played by a bot;
// - absent humans (setAway, a lost connection online): their stand-in bot plays their moves, never their claims, and
//   the next round does not wait for them.

export interface Scheduler {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface SeatSpec {
  id: PlayerId;
  name: string;
  kind: 'human' | 'bot';
  /** For a bot. */
  level?: BotLevel;
}

export interface TableOptions {
  seed: number;
  rules: RuleSet;
  seats: SeatSpec[];
  scheduler: Scheduler;
  /** The bots' pace from the first move (setBotPace). */
  botPace?: number;
}

export type SubmitResult = { ok: true; deferred?: boolean } | { ok: false; error: string };

/** How long an all-bot table waits before dealing the next round. */
const BOT_ROUND_PAUSE_MS = 2500;
/** The level that plays a human's turn when their timer runs out. */
const STAND_IN_LEVEL: BotLevel = 'medium';

interface Plan {
  action: Action;
  handle: unknown;
}

export class Table {
  readonly rules: RuleSet;
  readonly seats: readonly SeatSpec[];
  private state: GameState;
  private readonly scheduler: Scheduler;
  private readonly bots = new Map<PlayerId, Bot>();
  /** Bots standing by to play a timed-out or absent human's turn; they watch the game like the others. */
  private readonly standIns = new Map<PlayerId, Bot>();
  private readonly logs = new Map<PlayerId, GameEvent[]>();
  /** The events everyone received: what a shared screen may show. */
  private readonly publicLog: GameEvent[] = [];
  private readonly plans = new Map<PlayerId, Plan>();
  private readonly listeners = new Set<() => void>();
  private readonly continued = new Set<PlayerId>();
  private readonly away = new Set<PlayerId>();
  private rng: number;
  private windowSince: number | null = null;
  private deferredDraw: { action: Action; handle: unknown } | null = null;
  private hostTimer: unknown = null;
  private turnTimer: { key: string; handle: unknown } | null = null;
  private disposed = false;
  /** What the bots' turn delays are multiplied by (setBotPace). */
  private botPace = 1;

  constructor({ seed, rules, seats, scheduler, botPace }: TableOptions) {
    this.rules = rules;
    if (botPace !== undefined) this.setBotPace(botPace);
    this.seats = seats;
    this.scheduler = scheduler;
    this.rng = (seed ^ 0x2545f491) >>> 0;
    seats.forEach((s, i) => {
      this.logs.set(s.id, []);
      const botSeed = (seed * 31 + i * 7919) >>> 0;
      if (s.kind === 'bot') this.bots.set(s.id, new Bot(s.id, s.level ?? 'medium', rules, botSeed));
      else this.standIns.set(s.id, new Bot(s.id, STAND_IN_LEVEL, rules, botSeed));
    });
    const created = createGame({ seed, players: seats.map((s) => ({ id: s.id, name: s.name })), rules });
    this.state = created.state;
    this.deliver(created.events);
    this.after();
  }

  // ------------------------------------------------------------ reading

  view(seat: PlayerId): PlayerView {
    return viewFor(this.state, seat, this.rules);
  }

  /** Every event this seat has received, oldest first. */
  events(seat: PlayerId): readonly GameEvent[] {
    return this.logs.get(seat) ?? [];
  }

  /** Public events only, oldest first: the log of a screen several players look at (pass-and-play). */
  publicEvents(): readonly GameEvent[] {
    return this.publicLog;
  }

  humans(): PlayerId[] {
    return this.seats.filter((s) => s.kind === 'human').map((s) => s.id);
  }

  /**
   * The human the game waits for right now, if any: the first one still memorising their initial peek, or the current
   * player when it is a human's turn. Null while bots play, between rounds, or when only quick discards remain.
   */
  humanToAct(): PlayerId | null {
    const s = this.state;
    if (s.phase === 'initialPeek') {
      return this.humans().find((h) => !s.peek[h]?.ready && !s.players.find((p) => p.id === h)?.eliminated) ?? null;
    }
    if (s.phase === 'play' && s.current && this.isHuman(s.current)) return s.current;
    return null;
  }

  isHuman(seat: PlayerId): boolean {
    return this.seats.some((s) => s.id === seat && s.kind === 'human');
  }

  /** Humans who asked for the next round. */
  readyForNext(): PlayerId[] {
    return [...this.continued];
  }

  /** Humans currently played by their stand-in. */
  awayPlayers(): PlayerId[] {
    return [...this.away];
  }

  /** Milliseconds left before a draw is allowed, 0 when the quick-discard window has run its minimum. */
  windowRemaining(): number {
    // No quick discard, nothing to wait for: draws and the end of a round go through at once.
    if (this.windowSince === null || !this.rules.quickDiscard.enabled) return 0;
    return Math.max(0, this.windowSince + this.rules.quickDiscard.minWindowMs - this.scheduler.now());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.disposed = true;
    for (const p of this.plans.values()) this.scheduler.clearTimeout(p.handle);
    this.plans.clear();
    if (this.deferredDraw) this.scheduler.clearTimeout(this.deferredDraw.handle);
    if (this.hostTimer !== null) this.scheduler.clearTimeout(this.hostTimer);
    if (this.turnTimer) this.scheduler.clearTimeout(this.turnTimer.handle);
    this.listeners.clear();
  }

  // ------------------------------------------------------------ humans

  /** A human's intention. A draw that comes before the window's minimum is accepted and played when it runs out. */
  submit(action: Action): SubmitResult {
    if (this.disposed) return { ok: false, error: 'disposed' };
    if (action.by === 'host' || !this.isHuman(action.by)) return { ok: false, error: 'notYourSeat' };
    if (action.type === 'draw') {
      if (this.deferredDraw) return { ok: false, error: 'alreadyDrawing' };
      const wait = this.windowRemaining();
      if (wait > 0) {
        if (!legalActions(this.view(action.by), this.rules).some((a) => same(a, action))) {
          return { ok: false, error: 'illegal' };
        }
        const handle = this.scheduler.setTimeout(() => {
          this.deferredDraw = null;
          this.play(action);
        }, wait);
        this.deferredDraw = { action, handle };
        this.notify();
        return { ok: true, deferred: true };
      }
    }
    const r = this.play(action);
    return r === null ? { ok: true } : { ok: false, error: r };
  }

  /** A human is ready for the next round. The round is dealt once every human is. */
  continue(seat: PlayerId): void {
    if (this.state.phase !== 'roundOver' || !this.isHuman(seat)) return;
    this.continued.add(seat);
    this.after();
  }

  /**
   * A human is gone (away) or back. While away, their stand-in plays their initial peek and their turns at a bot's
   * pace, and the next round is dealt without waiting for them; back, they take over from the next move.
   */
  setAway(seat: PlayerId, away: boolean): void {
    if (this.disposed || !this.isHuman(seat) || this.away.has(seat) === away) return;
    if (away) this.away.add(seat);
    else this.away.delete(seat);
    this.after();
  }

  /**
   * How long the bots take over a turn's move, as a factor of their level's delay (a device's setting in solo: the
   * owner's "rythme des bots"). A quick-discard reaction keeps its delay: it decides who wins the claim, not how the
   * game reads. Applies from the next move a bot plans.
   */
  setBotPace(factor: number): void {
    this.botPace = Number.isFinite(factor) && factor > 0 ? factor : 1;
  }

  /** Whether a human's draw is waiting for the window to run out. */
  drawPending(): boolean {
    return this.deferredDraw !== null;
  }

  // ------------------------------------------------------------ core

  /** Applies an action; returns the engine's error code, or null. */
  private play(action: Action): string | null {
    if (this.disposed) return 'disposed';
    const wasOpen = this.state.window;
    const r = apply(this.state, action, this.rules);
    if (!r.ok) return r.error;
    this.state = r.state;
    if (this.state.window && (!wasOpen || action.type === 'endRound')) this.windowSince = this.scheduler.now();
    if (!this.state.window) this.windowSince = null;
    if (action.type === 'nextRound') this.continued.clear();
    this.deliver(r.events);
    this.after();
    return null;
  }

  private deliver(events: GameEvent[]): void {
    this.publicLog.push(...events.filter((e) => !('to' in e)));
    for (const seat of this.seats) {
      const mine = events.filter((e) => isVisibleTo(e, seat.id));
      this.logs.get(seat.id)?.push(...mine);
      this.bots.get(seat.id)?.observe(mine);
      this.standIns.get(seat.id)?.observe(mine);
    }
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }

  private random(): number {
    const [r, next] = nextRandom(this.rng);
    this.rng = next;
    return r;
  }

  private delay([min, max]: [number, number]): number {
    return Math.round(min + this.random() * (max - min));
  }

  /** After every change: re-plan the bots, the host's next action and the turn timer, then tell the listeners. */
  private after(): void {
    if (this.disposed) return;
    this.planBots();
    this.planHost();
    this.planTurnTimer();
    this.notify();
  }

  private planBots(): void {
    // A human back from being away drops the move their stand-in had planned.
    for (const [id, plan] of this.plans) {
      if (this.isHuman(id) && !this.away.has(id)) {
        this.scheduler.clearTimeout(plan.handle);
        this.plans.delete(id);
      }
    }
    const actors: [PlayerId, Bot, boolean][] = [...this.bots].map(([id, bot]) => [id, bot, true]);
    for (const id of this.away) {
      const bot = this.standIns.get(id);
      if (bot) actors.push([id, bot, false]);
    }
    for (const [id, bot, claims] of actors) {
      const view = this.view(id);
      const plan = this.plans.get(id);
      if (plan) {
        // A move still legal keeps its timer: re-deciding at every event would reset the delay forever.
        if (legalActions(view, this.rules).some((a) => same(a, plan.action))) continue;
        this.scheduler.clearTimeout(plan.handle);
        this.plans.delete(id);
      }
      const action = bot.decide(view, { claims });
      if (!action) continue;
      const profile = PROFILES[bot.profile.level];
      let wait =
        action.type === 'quickDiscard'
          ? this.delay(profile.delays.quickDiscard)
          : Math.round(this.delay(profile.delays.turn) * this.botPace);
      if (action.type === 'draw') wait = Math.max(wait, this.windowRemaining());
      const handle = this.scheduler.setTimeout(() => {
        this.plans.delete(id);
        // Refused only when something else happened first (a stale claim): the next plan decides again.
        if (this.play(action) !== null) this.after();
      }, wait);
      this.plans.set(id, { action, handle });
    }
  }

  private planHost(): void {
    if (this.hostTimer !== null) return;
    const owed = hostAction(this.state);
    if (!owed) return;
    let wait = 0;
    if (owed.type === 'endRound') wait = this.windowRemaining();
    if (owed.type === 'nextRound') {
      const humans = this.humans().filter((h) => !this.away.has(h));
      if (humans.length > 0 && !humans.every((h) => this.continued.has(h))) return;
      if (humans.length === 0) wait = BOT_ROUND_PAUSE_MS;
    }
    this.hostTimer = this.scheduler.setTimeout(() => {
      this.hostTimer = null;
      this.play(owed);
    }, wait);
  }

  private planTurnTimer(): void {
    const seconds = this.rules.pace.turnTimerSeconds;
    const current = this.state.current;
    const key = `${this.state.round}:${current}:${current ? this.state.turns[current] : ''}`;
    if (this.turnTimer && this.turnTimer.key === key) return;
    if (this.turnTimer) this.scheduler.clearTimeout(this.turnTimer.handle);
    this.turnTimer = null;
    if (seconds <= 0 || this.state.phase !== 'play' || !current || !this.isHuman(current) || this.away.has(current)) {
      return;
    }
    const handle = this.scheduler.setTimeout(() => {
      this.turnTimer = null;
      this.standIn(current);
    }, seconds * 1000);
    this.turnTimer = { key, handle };
  }

  /** The human's time is up: their stand-in bot plays the rest of the turn. */
  private standIn(seat: PlayerId): void {
    const bot = this.standIns.get(seat);
    if (!bot) return;
    if (this.deferredDraw) {
      this.scheduler.clearTimeout(this.deferredDraw.handle);
      this.deferredDraw = null;
    }
    for (let guard = 0; guard < 10 && this.state.current === seat && this.state.phase === 'play'; guard++) {
      const action = bot.decide(this.view(seat));
      if (!action || action.type === 'quickDiscard') break;
      if (this.play(action) !== null) break;
    }
  }
}

/** JSON with sorted keys: an action built by a client and one listed by legalActions may order their fields apart. */
const canonical = (v: unknown): string =>
  JSON.stringify(v, (_k, x: unknown) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([p], [q]) => (p < q ? -1 : 1)))
      : x,
  );
const same = (a: Action, b: Action) => canonical(a) === canonical(b);
