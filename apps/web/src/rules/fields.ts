import { mergeRuleInputs, parseRules, type RuleSet, safeParseRules } from '@tamalou/shared';
import type { Key } from '../i18n/index.ts';

// Every setting of the game master's screen (docs/SPEC.md §3), one entry per RuleSet field: where it lives in the
// RuleSet, how it is edited, its bounds (the schema's, or tighter where a phone needs it) and its French label and
// help. Adding a rule to the RuleSet means adding its line here, and its keys `rule_<id>` / `rule_<id>_help`.

export type Path = readonly string[];

interface Base {
  id: string;
  path: Path;
  /** Shown only when this holds (a sub-setting of a switched-off option is hidden, not disabled). */
  when?: (r: RuleSet) => boolean;
}

export type Field =
  | (Base & { kind: 'toggle' })
  | (Base & { kind: 'number'; min: number; max: number; step: number; unit?: 'points' | 'seconds' | 'ms' })
  | (Base & { kind: 'select'; options: { value: string; label: Key }[] })
  | (Base & { kind: 'rankValues' })
  | (Base & { kind: 'rankPowers' })
  | (Base & { kind: 'overrides' })
  | (Base & { kind: 'peekSlots' });

export interface Section {
  id: string;
  title: Key;
  fields: Field[];
}

export const SECTIONS: Section[] = [
  {
    id: 'deck',
    title: 'sec_deck',
    fields: [
      { id: 'deckCount', kind: 'number', path: ['deck', 'count'], min: 1, max: 2, step: 1 },
      { id: 'jokers', kind: 'toggle', path: ['deck', 'jokers'] },
      {
        id: 'jokersPerDeck',
        kind: 'number',
        path: ['deck', 'jokersPerDeck'],
        min: 1,
        max: 4,
        step: 1,
        when: (r) => r.deck.jokers,
      },
    ],
  },
  {
    id: 'values',
    title: 'sec_values',
    fields: [
      { id: 'rankValues', kind: 'rankValues', path: ['values', 'byRank'] },
      { id: 'overrides', kind: 'overrides', path: ['values', 'overrides'] },
    ],
  },
  {
    id: 'hand',
    title: 'sec_hand',
    fields: [
      { id: 'handSize', kind: 'number', path: ['hand', 'size'], min: 2, max: 8, step: 1 },
      { id: 'columns', kind: 'number', path: ['hand', 'columns'], min: 1, max: 4, step: 1 },
      {
        id: 'peekMode',
        kind: 'select',
        path: ['hand', 'initialPeek', 'mode'],
        options: [
          { value: 'fixed', label: 'opt_peekFixed' },
          { value: 'choose', label: 'opt_peekChoose' },
        ],
      },
      {
        id: 'peekSlots',
        kind: 'peekSlots',
        path: ['hand', 'initialPeek', 'slots'],
        when: (r) => r.hand.initialPeek.mode === 'fixed',
      },
      {
        id: 'peekCount',
        kind: 'number',
        path: ['hand', 'initialPeek', 'count'],
        min: 0,
        max: 8,
        step: 1,
        when: (r) => r.hand.initialPeek.mode === 'choose',
      },
    ],
  },
  {
    id: 'powers',
    title: 'sec_powers',
    fields: [
      { id: 'rankPowers', kind: 'rankPowers', path: ['powers', 'byRank'] },
      {
        id: 'activation',
        kind: 'select',
        path: ['powers', 'activation'],
        options: [
          { value: 'drawPile', label: 'opt_drawPile' },
          { value: 'anyPile', label: 'opt_anyPile' },
        ],
      },
      { id: 'mustSwap', kind: 'toggle', path: ['discardPickup', 'mustSwap'] },
    ],
  },
  {
    id: 'quick',
    title: 'sec_quick',
    fields: [
      { id: 'quickEnabled', kind: 'toggle', path: ['quickDiscard', 'enabled'] },
      {
        id: 'penaltyCards',
        kind: 'number',
        path: ['quickDiscard', 'penaltyCards'],
        min: 0,
        max: 4,
        step: 1,
        when: (r) => r.quickDiscard.enabled,
      },
      {
        id: 'opponentCards',
        kind: 'toggle',
        path: ['quickDiscard', 'allowOpponentCards'],
        when: (r) => r.quickDiscard.enabled,
      },
      {
        id: 'minWindow',
        kind: 'number',
        path: ['quickDiscard', 'minWindowMs'],
        min: 0,
        max: 10_000,
        step: 500,
        unit: 'ms',
        when: (r) => r.quickDiscard.enabled,
      },
    ],
  },
  {
    id: 'tamalou',
    title: 'sec_tamalou',
    fields: [
      {
        id: 'timing',
        kind: 'select',
        path: ['tamalou', 'timing'],
        options: [
          { value: 'startOfTurn', label: 'opt_startOfTurn' },
          { value: 'endOfTurn', label: 'opt_endOfTurn' },
        ],
      },
      { id: 'minTurns', kind: 'number', path: ['tamalou', 'minTurnsBeforeCall'], min: 0, max: 20, step: 1 },
      { id: 'lockCaller', kind: 'toggle', path: ['tamalou', 'lockCallerCards'] },
      {
        id: 'failMode',
        kind: 'select',
        path: ['tamalou', 'failPenalty', 'mode'],
        options: [
          { value: 'add', label: 'opt_failAdd' },
          { value: 'double', label: 'opt_failDouble' },
        ],
      },
      {
        id: 'failAmount',
        kind: 'number',
        path: ['tamalou', 'failPenalty', 'amount'],
        min: 0,
        max: 100,
        step: 5,
        unit: 'points',
        when: (r) => r.tamalou.failPenalty.mode === 'add',
      },
      {
        id: 'winBonus',
        kind: 'select',
        path: ['tamalou', 'winBonus'],
        options: [
          { value: 'none', label: 'opt_bonusNone' },
          { value: 'zero', label: 'opt_bonusZero' },
        ],
      },
      { id: 'emptyHand', kind: 'toggle', path: ['round', 'emptyHandEndsRound'] },
    ],
  },
  {
    id: 'end',
    title: 'sec_end',
    fields: [
      {
        id: 'endMode',
        kind: 'select',
        path: ['gameEnd', 'mode'],
        options: [
          { value: 'threshold', label: 'opt_endThreshold' },
          { value: 'rounds', label: 'opt_endRounds' },
        ],
      },
      {
        id: 'threshold',
        kind: 'number',
        path: ['gameEnd', 'threshold'],
        min: 10,
        max: 500,
        step: 10,
        unit: 'points',
        when: (r) => r.gameEnd.mode === 'threshold',
      },
      {
        id: 'thresholdEnd',
        kind: 'select',
        path: ['gameEnd', 'thresholdEnd'],
        options: [
          { value: 'lastStanding', label: 'opt_lastStanding' },
          { value: 'firstElimination', label: 'opt_firstElimination' },
        ],
        when: (r) => r.gameEnd.mode === 'threshold',
      },
      {
        id: 'rounds',
        kind: 'number',
        path: ['gameEnd', 'rounds'],
        min: 1,
        max: 50,
        step: 1,
        when: (r) => r.gameEnd.mode === 'rounds',
      },
    ],
  },
  {
    id: 'pace',
    title: 'sec_pace',
    fields: [
      {
        id: 'turnTimer',
        kind: 'number',
        path: ['pace', 'turnTimerSeconds'],
        min: 0,
        max: 300,
        step: 15,
        unit: 'seconds',
      },
      { id: 'beginner', kind: 'toggle', path: ['assist', 'showKnownCards'] },
    ],
  },
];

export function getAt(rules: RuleSet, path: Path): unknown {
  return path.reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], rules);
}

/**
 * The rules with one setting changed, made consistent and validated. Other settings that depend on it follow: a
 * smaller hand drops the peeked slots that no longer exist, and in fixed mode the peek count is the number of slots.
 * Returns null when the schema still refuses the result (the editor then keeps the previous rules).
 */
export function setAt(rules: RuleSet, path: Path, value: unknown): RuleSet | null {
  const patch = path.reduceRight<unknown>((inner, key) => ({ [key]: inner }), value) as Record<string, unknown>;
  // Arrays and per-rank maps are replaced whole by mergeRuleInputs, which is what a setting means.
  const next = mergeRuleInputs(rules, patch) as RuleSet;
  const size = next.hand.size;
  const peek = next.hand.initialPeek;
  const slots = peek.slots.filter((s) => s < size);
  const count = peek.mode === 'fixed' ? slots.length : Math.min(peek.count, size);
  const fixed = mergeRuleInputs(next, { hand: { initialPeek: { slots, count } } });
  const parsed = safeParseRules(fixed);
  return parsed.success ? parsed.data : null;
}

/** The value as the number control shows it (milliseconds as seconds). */
export const displayNumber = (f: Extract<Field, { kind: 'number' }>, v: number) => (f.unit === 'ms' ? v / 1000 : v);

/** A RuleSet from anything stored or typed, falling back to the defaults. */
export const safeRules = (input: unknown): RuleSet => {
  const parsed = safeParseRules(input);
  return parsed.success ? parsed.data : parseRules({});
};
