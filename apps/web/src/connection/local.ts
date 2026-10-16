import type { BotLevel } from '@tamalou/bots';
import { type Scheduler, Table } from '@tamalou/room';
import type { Action, PlayerId, RuleSet } from '@tamalou/shared';
import type { GameConnection, SendResult } from './types.ts';

// The game in this browser: a room Table with the real clock. Solo now, pass-and-play in M5.

const realClock: Scheduler = {
  now: () => performance.now(),
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>),
};

export interface SoloSetup {
  name: string;
  bots: { name: string; level: BotLevel }[];
  rules: RuleSet;
  seed?: number;
}

export const HUMAN_ID = 'you';

export class LocalConnection implements GameConnection {
  readonly me: PlayerId = HUMAN_ID;
  readonly rules: RuleSet;
  private readonly table: Table;

  constructor(setup: SoloSetup, scheduler: Scheduler = realClock) {
    this.rules = setup.rules;
    this.table = new Table({
      seed: setup.seed ?? Math.floor(Math.random() * 2 ** 32),
      rules: setup.rules,
      scheduler,
      seats: [
        { id: HUMAN_ID, name: setup.name, kind: 'human' },
        ...setup.bots.map((b, i) => ({ id: `bot${i + 1}`, name: b.name, kind: 'bot' as const, level: b.level })),
      ],
    });
  }

  view() {
    return this.table.view(this.me);
  }
  events() {
    return this.table.events(this.me);
  }
  send(action: Action): SendResult {
    return this.table.submit(action);
  }
  continueRound() {
    this.table.continue(this.me);
  }
  readyForNext() {
    return this.table.readyForNext();
  }
  drawPending() {
    return this.table.drawPending();
  }
  subscribe(listener: () => void) {
    return this.table.subscribe(listener);
  }
  dispose() {
    this.table.dispose();
  }
}
