import type { RuleSet } from '@tamalou/shared';
import { type Key, t } from '../i18n/index.ts';

// What a preset's card says on the launch screen (the owner, 2026-11-26: a sentence per preset read badly; he asked for
// a list with the values in bold). Read from the preset's own rules, so a card cannot say what the game does not do:
// the facts that differ from Classique first in importance, the main ones to fill, four at most, in one fixed order.

export interface Fact {
  /** Stable, for React keys and tests. */
  id: string;
  label: string;
  value: string;
  /** Differs from Classique: the card shows it in the accent. */
  changed: boolean;
}

const MAX = 4;
/** Shown even when equal to Classique, while there is room: what a player asks first about a game. */
const MAIN = new Set(['cards', 'end', 'finish', 'fail']);

function all(r: RuleSet): Omit<Fact, 'changed'>[] {
  const end = r.gameEnd;
  const fail = r.tamalou.failPenalty;
  const facts: Omit<Fact, 'changed'>[] = [
    { id: 'cards', label: t('factCards'), value: String(r.hand.size) },
    end.mode === 'rounds'
      ? { id: 'end', label: t('factRounds'), value: String(end.rounds) }
      : { id: 'end', label: t('factOut'), value: String(end.threshold) },
  ];
  if (end.mode === 'threshold') {
    facts.push({ id: 'finish', label: t('factEnd'), value: t(`factEnd_${end.thresholdEnd}` as Key) });
  }
  facts.push({ id: 'fail', label: t('factFail'), value: fail.mode === 'double' ? '×2' : `+${fail.amount}` });
  if (r.assist.showKnownCards) facts.push({ id: 'known', label: t('factKnown'), value: t('factKnown_on') });
  facts.push({ id: 'log', label: t('factLog'), value: t(`factLog_${r.assist.log}` as Key) });
  if (r.assist.discardStory) facts.push({ id: 'story', label: t('factStory'), value: t('factStory_on') });
  return facts;
}

/** The lines of a preset's card: `rules` the preset's, `classic` Classique's. */
export function presetFacts(rules: RuleSet, classic: RuleSet): Fact[] {
  const before = new Map(all(classic).map((f) => [f.id, f.value]));
  const facts = all(rules).map((f) => ({ ...f, changed: before.get(f.id) !== f.value }));
  const changed = facts.filter((f) => f.changed);
  const kept = new Set(changed.slice(0, MAX).map((f) => f.id));
  for (const f of facts) if (kept.size < MAX && MAIN.has(f.id)) kept.add(f.id);
  return facts.filter((f) => kept.has(f.id));
}
