// Bot against bot: how often each level wins (M2's acceptance test is "hard clearly beats easy").
//
//   pnpm bots                                    # hard vs easy, then hard vs medium, then medium vs easy, 2 seats
//   pnpm bots --levels hard,easy,easy,medium --games 400 --preset quick
//
// Exit code 1 if a game crashed, stalled or got stuck.

import { parseArgs } from 'node:util';
import { rulesFromPreset } from '@tamalou/shared';
import { BOT_LEVELS, type BotLevel } from '../bot.ts';
import { tournament } from '../match.ts';

const { values } = parseArgs({
  options: {
    games: { type: 'string', default: '300' },
    levels: { type: 'string' },
    preset: { type: 'string', default: 'classic' },
    seed: { type: 'string', default: '1' },
  },
});

const parseLevels = (text: string): BotLevel[] =>
  text.split(',').map((l) => {
    if (!(BOT_LEVELS as readonly string[]).includes(l)) throw new Error(`unknown level ${l}`);
    return l as BotLevel;
  });

const tables: BotLevel[][] = values.levels
  ? [parseLevels(values.levels)]
  : [
      ['hard', 'easy'],
      ['hard', 'medium'],
      ['medium', 'easy'],
      ['hard', 'medium', 'easy'],
    ];
const rules = rulesFromPreset(values.preset);
let failed = false;

for (const levels of tables) {
  const started = performance.now();
  const { byLevel, problems } = tournament({ games: Number(values.games), rules, levels, seed: Number(values.seed) });
  const s = ((performance.now() - started) / 1000).toFixed(1);
  console.log(`\n${levels.join(' contre ')} — ${values.games} parties (${s} s)`);
  for (const l of byLevel) {
    const pct = ((100 * l.wins) / (l.seats / levels.filter((x) => x === l.level).length)).toFixed(0);
    console.log(`  ${l.level.padEnd(7)} victoires ${pct.padStart(3)} %   total moyen ${l.meanTotal.toFixed(0)}`);
  }
  if (problems.length > 0) {
    failed = true;
    console.log(`  ${problems.length} problème(s) : ${problems.slice(0, 5).join(' ; ')}`);
  }
}
if (failed) process.exitCode = 1;
