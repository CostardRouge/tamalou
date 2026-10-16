import type { Action, GameEvent } from '@tamalou/shared';
import { apply, createGame, type NewGame } from './game.ts';
import type { EngineError, GameState } from './state.ts';

// A game is its seed, its table, its rules and its accepted actions: replaying them rebuilds the same state, event for
// event. A refused action is part of no record (the engine left the state as it was), so a replay stops on one.

export interface GameRecord extends NewGame {
  actions: Action[];
}

export function replay(record: GameRecord): { state: GameState; events: GameEvent[] } {
  let { state, events } = createGame(record);
  const all = [...events];
  for (const [i, action] of record.actions.entries()) {
    const r = apply(state, action, record.rules);
    if (!r.ok) throw new ReplayError(i, action, r.error);
    state = r.state;
    all.push(...r.events);
  }
  return { state, events: all };
}

export class ReplayError extends Error {
  readonly index: number;
  readonly action: Action;
  readonly code: EngineError;
  constructor(index: number, action: Action, code: EngineError) {
    super(`action ${index} (${action.type}) refused: ${code}`);
    this.index = index;
    this.action = action;
    this.code = code;
  }
}
