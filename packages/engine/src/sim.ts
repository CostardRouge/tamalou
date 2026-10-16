import type { Action, GameEvent, PlayerId, RuleSet } from '@tamalou/shared';
import { apply, createGame } from './game.ts';
import { hostAction, legalActions } from './legal.ts';
import { nextRandom } from './rng.ts';
import type { GameState } from './state.ts';
import { viewFor } from './view.ts';

// Random legal play, for the simulation CLI and the property tests: every move is picked among legalActions() of a
// player's own view, so it exercises exactly what a client may send. The bots of packages/bots replace the choice;
// this driver stays the engine's own smoke test. Its randomness is separate from the game's.

export interface RandomGameOptions {
  seed: number;
  players: number;
  rules: RuleSet;
  /** Driver's seed; defaults to the game's. */
  driverSeed?: number;
  /** Chance, per step, that some player tries a quick discard when one is legal. */
  quickDiscardRate?: number;
  /** Weight of calling Tamalou when it is legal, against 1 for each other move. */
  callWeight?: number;
  /** A game still running after this many actions is reported as stalled. */
  maxActions?: number;
}

export interface RandomGameResult {
  state: GameState;
  events: GameEvent[];
  actions: Action[];
  outcome: 'finished' | 'stalled' | 'stuck';
}

export function playRandomGame(opts: RandomGameOptions): RandomGameResult {
  const { rules } = opts;
  const quickRate = opts.quickDiscardRate ?? 0.03;
  const callWeight = opts.callWeight ?? 0.15;
  const maxActions = opts.maxActions ?? 50_000;
  const players = Array.from({ length: opts.players }, (_, i) => ({ id: `p${i + 1}`, name: `Joueur ${i + 1}` }));
  const driver = { rng: (opts.driverSeed ?? opts.seed ^ 0x5bd1e995) >>> 0 };
  const random = () => {
    const [r, next] = nextRandom(driver.rng);
    driver.rng = next;
    return r;
  };
  const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)] as T;

  let { state, events } = createGame({ seed: opts.seed, players, rules });
  const allEvents = [...events];
  const actions: Action[] = [];

  while (actions.length < maxActions) {
    if (state.phase === 'gameOver') return { state, events: allEvents, actions, outcome: 'finished' };
    let action: Action | null = hostAction(state);
    if (!action)
      action = chooseMove(
        state,
        rules,
        players.map((p) => p.id),
        random,
        pick,
        quickRate,
        callWeight,
      );
    if (!action) return { state, events: allEvents, actions, outcome: 'stuck' };
    const r = apply(state, action, rules);
    if (!r.ok) throw new Error(`legal action refused: ${JSON.stringify(action)} → ${r.error}`);
    state = r.state;
    actions.push(action);
    allEvents.push(...r.events);
  }
  return { state, events: allEvents, actions, outcome: 'stalled' };
}

function chooseMove(
  state: GameState,
  rules: RuleSet,
  ids: PlayerId[],
  random: () => number,
  pick: <T>(items: T[]) => T,
  quickRate: number,
  callWeight: number,
): Action | null {
  const byPlayer = ids.map((id) => ({ id, legal: legalActions(viewFor(state, id, rules), rules) }));
  const quick = byPlayer.flatMap((p) => p.legal.filter((a) => a.type === 'quickDiscard'));
  const turn = byPlayer.flatMap((p) => p.legal.filter((a) => a.type !== 'quickDiscard'));
  if (quick.length > 0 && (turn.length === 0 || random() < quickRate)) return pick(quick);
  if (turn.length === 0) return null;
  const calls = turn.filter((a) => a.type === 'callTamalou');
  const others = turn.filter((a) => a.type !== 'callTamalou');
  if (calls.length > 0 && (others.length === 0 || random() < callWeight / (callWeight + 1))) return pick(calls);
  return pick(others);
}
