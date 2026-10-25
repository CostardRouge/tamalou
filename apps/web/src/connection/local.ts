import type { BotLevel } from '@tamalou/bots';
import { Handoff, type Scheduler, systemClock, Table } from '@tamalou/room';
import type { Action, PlayerId, RuleSet } from '@tamalou/shared';
import type { GameConnection, SendResult } from './types.ts';

// The game in this browser: a room Table with the real clock. One human is solo; several humans share the device
// (pass-and-play, docs/SPEC.md §5.2): the screen then shows a player's view only once the device has been handed to
// them (Handoff), the public table in between, and only the public log.

export interface LocalSetup {
  humans: string[];
  bots: { name: string; level: BotLevel }[];
  rules: RuleSet;
  seed?: number;
  /** The bots' pace from the first move (Table.setBotPace). */
  botPace?: number;
}

/** The solo player's seat id (kept stable for tests and the log's "Tu"). */
export const HUMAN_ID = 'you';

export class LocalConnection implements GameConnection {
  readonly rules: RuleSet;
  private readonly table: Table;
  private readonly humanIds: PlayerId[];
  private readonly names = new Map<PlayerId, string>();
  /** Pass-and-play only. */
  private readonly passing: Handoff | null;
  /** The screen's listeners: told about the table's changes and about the device changing hands. */
  private readonly listeners = new Set<() => void>();

  constructor(setup: LocalSetup, scheduler: Scheduler = systemClock) {
    this.rules = setup.rules;
    const solo = setup.humans.length === 1;
    this.humanIds = setup.humans.map((_, i) => (solo ? HUMAN_ID : `p${i + 1}`));
    this.passing = solo ? null : new Handoff();
    const seats = [
      ...setup.humans.map((name, i) => ({ id: this.humanIds[i] as string, name, kind: 'human' as const })),
      ...setup.bots.map((b, i) => ({ id: `bot${i + 1}`, name: b.name, kind: 'bot' as const, level: b.level })),
    ];
    for (const s of seats) this.names.set(s.id, s.name);
    this.table = new Table({
      seed: setup.seed ?? Math.floor(Math.random() * 2 ** 32),
      rules: setup.rules,
      scheduler,
      seats,
      botPace: setup.botPace,
    });
  }

  get me(): PlayerId {
    if (!this.passing) return this.humanIds[0] as PlayerId;
    this.passing.update(this.table.humanToAct());
    return this.passing.viewer;
  }

  view() {
    return this.table.view(this.me);
  }
  events() {
    // A shared screen shows what everyone may see; a single player's screen shows their own log.
    return this.passing ? this.table.publicEvents() : this.table.events(this.me);
  }
  send(action: Action): SendResult {
    return this.table.submit(action);
  }
  continueRound() {
    for (const h of this.humanIds) this.table.continue(h);
  }
  readyForNext() {
    return this.table.readyForNext();
  }
  drawPending() {
    return this.table.drawPending();
  }
  setBotPace(factor: number) {
    this.table.setBotPace(factor);
  }
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    const off = this.table.subscribe(listener);
    return () => {
      this.listeners.delete(listener);
      off();
    };
  }
  dispose() {
    this.table.dispose();
  }

  get handoff() {
    if (!this.passing) return undefined;
    return () => {
      this.passing?.update(this.table.humanToAct());
      const id = this.passing?.pending ?? null;
      return id === null ? null : { id, name: this.names.get(id) ?? id };
    };
  }
  get reveal() {
    if (!this.passing) return undefined;
    return () => {
      this.passing?.reveal();
      for (const l of this.listeners) l();
    };
  }
  get claimers() {
    if (!this.passing) return undefined;
    return () => [...this.humanIds];
  }
  get viewOf() {
    if (!this.passing) return undefined;
    return (seat: PlayerId) => this.table.view(seat);
  }
}
