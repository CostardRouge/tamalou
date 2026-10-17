import { apply, createGame, type GameState, hostAction, nextRandom, viewFor } from '@tamalou/engine';
import { type Action, type GameEvent, isVisibleTo, type PlayerId, type RuleSet } from '@tamalou/shared';
import { Bot, type BotLevel } from './bot.ts';

// Bot against bot, with no clock: a stand-in for the host. After each accepted action every bot is handed the events
// its player receives; then any bot that wants to claim a quick discard gets to (in a random order: the first claim
// wins, a later one aimed at the same top card is refused as stale), and otherwise the current player moves.

export interface MatchOptions {
  seed: number;
  rules: RuleSet;
  /** One level per seat, in seat order. */
  levels: BotLevel[];
  maxActions?: number;
}

export interface MatchResult {
  state: GameState;
  actions: Action[];
  outcome: 'finished' | 'stalled' | 'stuck';
  /** Seat ids are `s0`, `s1`… in the order of `levels`. */
  winners: PlayerId[];
}

export function playMatch({ seed, rules, levels, maxActions = 20_000 }: MatchOptions): MatchResult {
  const players = levels.map((level, i) => ({ id: `s${i}`, name: `${level} ${i}` }));
  const bots = levels.map((level, i) => new Bot(`s${i}`, level, rules, (seed * 31 + i * 7919) >>> 0));
  const order = { rng: (seed ^ 0x9e3779b9) >>> 0 };
  const shuffled = () => {
    const out = [...bots];
    for (let i = out.length - 1; i > 0; i--) {
      const [r, next] = nextRandom(order.rng);
      order.rng = next;
      const j = Math.floor(r * (i + 1));
      [out[i], out[j]] = [out[j] as Bot, out[i] as Bot];
    }
    return out;
  };

  let { state, events } = createGame({ seed, players, rules });
  const deliver = (evs: GameEvent[]) => {
    for (const bot of bots) bot.observe(evs.filter((e) => isVisibleTo(e, bot.me)));
  };
  deliver(events);
  const actions: Action[] = [];

  while (actions.length < maxActions) {
    if (state.phase === 'gameOver') return { state, actions, outcome: 'finished', winners: state.winners ?? [] };
    let action: Action | null = hostAction(state);
    if (!action) {
      let turnMove: Action | null = null;
      for (const bot of shuffled()) {
        const a = bot.decide(viewFor(state, bot.me, rules));
        if (!a) continue;
        if (a.type === 'quickDiscard') {
          action = a;
          break;
        }
        // Several bots may have a move in the initial peek: take the first; on a turn there is only one.
        turnMove ??= a;
      }
      action ??= turnMove;
    }
    if (!action) return { state, actions, outcome: 'stuck', winners: [] };
    const r = apply(state, action, rules);
    if (!r.ok) throw new Error(`bot move refused (${r.error}): ${JSON.stringify(action)}`);
    state = r.state;
    events = r.events;
    actions.push(action);
    deliver(events);
  }
  return { state, actions, outcome: 'stalled', winners: [] };
}

export interface LevelStats {
  level: BotLevel;
  seats: number;
  /** Wins, a shared win counting 1/k. */
  wins: number;
  /** Mean final total. */
  meanTotal: number;
}

/** Plays `games` matches, rotating seats so no level keeps the first move, and sums up by level. */
export function tournament(opts: { games: number; rules: RuleSet; levels: BotLevel[]; seed?: number }) {
  const stats = new Map<BotLevel, { seats: number; wins: number; total: number }>();
  const problems: string[] = [];
  for (let g = 0; g < opts.games; g++) {
    const shift = g % opts.levels.length;
    const levels = [...opts.levels.slice(shift), ...opts.levels.slice(0, shift)];
    const seed = ((opts.seed ?? 1) + g * 104729) >>> 0;
    const res = playMatch({ seed, rules: opts.rules, levels });
    if (res.outcome !== 'finished') {
      problems.push(`seed ${seed}: ${res.outcome}`);
      continue;
    }
    levels.forEach((level, i) => {
      const s = stats.get(level) ?? { seats: 0, wins: 0, total: 0 };
      s.seats++;
      s.total += res.state.players[i]?.total ?? 0;
      if (res.winners.includes(`s${i}`)) s.wins += 1 / res.winners.length;
      stats.set(level, s);
    });
  }
  const byLevel: LevelStats[] = [...stats].map(([level, s]) => ({
    level,
    seats: s.seats,
    wins: s.wins,
    meanTotal: s.seats ? s.total / s.seats : 0,
  }));
  return { byLevel, problems };
}
