// Plays many random legal games and reports how they went: the engine's crash and deadlock detector (M1).
//
//   pnpm simulate                       # 1000 games, 2 to 6 players, the default rules
//   pnpm simulate --games 5000 --players 4 --preset quick --seed 42
//
// Exit code 1 if any game crashed, stalled or got stuck.

import { parseArgs } from 'node:util';
import { rulesFromPreset } from '@tamalou/shared';
import { playRandomGame } from '../sim.ts';

const { values } = parseArgs({
  options: {
    games: { type: 'string', default: '1000' },
    players: { type: 'string' },
    preset: { type: 'string', default: 'classic' },
    seed: { type: 'string', default: '1' },
  },
});

const games = Number(values.games);
const baseSeed = Number(values.seed);
const rules = rulesFromPreset(values.preset);
const started = performance.now();
let finished = 0;
let rounds = 0;
let actions = 0;
let quickDiscards = 0;
let failedClaims = 0;
let failedCalls = 0;
const problems: string[] = [];

for (let g = 0; g < games; g++) {
  const seed = (baseSeed + g * 7919) >>> 0;
  const players = values.players ? Number(values.players) : 2 + (g % 5);
  try {
    const r = playRandomGame({ seed, players, rules });
    if (r.outcome !== 'finished') {
      problems.push(`seed ${seed}, ${players} players: ${r.outcome} after ${r.actions.length} actions`);
      continue;
    }
    finished++;
    rounds += r.state.results.length;
    actions += r.actions.length;
    failedCalls += r.state.results.filter((x) => x.callerFailed).length;
    for (const e of r.events) {
      if (e.type === 'quickDiscard') quickDiscards++;
      if (e.type === 'quickDiscardFailed') failedClaims++;
    }
  } catch (err) {
    problems.push(`seed ${seed}, ${players} players: crashed — ${(err as Error).message}`);
  }
}

const ms = performance.now() - started;
const avg = (n: number) => (finished ? (n / finished).toFixed(1) : '—');
console.log(`${games} parties aléatoires (preset ${values.preset}) en ${(ms / 1000).toFixed(1)} s`);
console.log(`  terminées       ${finished}`);
console.log(`  manches/partie  ${avg(rounds)}`);
console.log(`  actions/partie  ${avg(actions)}`);
console.log(`  défausses rapides réussies ${quickDiscards}, ratées ${failedClaims}`);
console.log(`  Tamalou ratés   ${rounds ? ((100 * failedCalls) / rounds).toFixed(0) : 0} % des manches`);
if (problems.length > 0) {
  console.log(`\n${problems.length} problème(s) :`);
  for (const p of problems.slice(0, 20)) console.log(`  ${p}`);
  process.exitCode = 1;
}
