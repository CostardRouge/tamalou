import { describe, expect, it } from 'vitest';
import {
  choiceFromRules,
  DEFAULT_RULES,
  decodeRulesChoice,
  diffRuleInputs,
  encodeRulesChoice,
  exportRulesJson,
  importRulesJson,
  mergeRuleInputs,
  parseRules,
  rulesFromPreset,
  rulesOf,
} from '../src/index.ts';

describe('rules diff', () => {
  it('keeps only what changed, down to one rank, and rebuilds the rules', () => {
    const rules = parseRules({ values: { byRank: { Q: 12 } }, tamalou: { failPenalty: { mode: 'double' } } });
    const diff = diffRuleInputs(rules, DEFAULT_RULES);
    expect(diff).toEqual({ values: { byRank: { Q: 12 } }, tamalou: { failPenalty: { mode: 'double' } } });
    expect(parseRules(mergeRuleInputs(diff))).toEqual(rules);
    expect(diffRuleInputs(DEFAULT_RULES, DEFAULT_RULES)).toEqual({});
  });

  it('replaces arrays whole', () => {
    const rules = parseRules({ hand: { initialPeek: { slots: [0, 1] } }, values: { overrides: [] } });
    expect(diffRuleInputs(rules, DEFAULT_RULES)).toEqual({
      hand: { initialPeek: { slots: [0, 1] } },
      values: { overrides: [] },
    });
  });

  it('measures a choice against its preset', () => {
    const rules = rulesFromPreset('quick', { deck: { jokers: true } });
    const choice = choiceFromRules('quick', rules);
    expect(choice).toEqual({ preset: 'quick', overrides: { deck: { jokers: true } } });
    expect(rulesOf(choice)).toEqual(rules);
  });
});

describe('mode defaults', () => {
  it('sit between the preset and the changes', () => {
    const base = { quickDiscard: { enabled: false } };
    expect(rulesOf({ preset: 'classic', overrides: {} }, base).quickDiscard.enabled).toBe(false);
    const on = rulesOf({ preset: 'classic', overrides: { quickDiscard: { enabled: true } } }, base);
    expect(on.quickDiscard.enabled).toBe(true);
    expect(choiceFromRules('classic', on, base)).toEqual({
      preset: 'classic',
      overrides: { quickDiscard: { enabled: true } },
    });
    expect(choiceFromRules('classic', rulesOf({ preset: 'classic', overrides: {} }, base), base).overrides).toEqual({});
  });
});

describe('JSON export and import', () => {
  it('round-trips the full rules', () => {
    // The tamalou section is the one an export tag named "tamalou" once overwrote.
    const rules = parseRules({ deck: { count: 2 }, pace: { turnTimerSeconds: 30 }, tamalou: { winBonus: 'zero' } });
    const res = importRulesJson(exportRulesJson(rules));
    expect(res).toEqual({ ok: true, rules });
  });

  it('accepts a partial file and refuses broken ones', () => {
    expect(importRulesJson('{"gameEnd":{"threshold":60}}')).toMatchObject({
      ok: true,
      rules: { gameEnd: { threshold: 60 } },
    });
    expect(importRulesJson('not json')).toEqual({ ok: false, error: 'json' });
    expect(importRulesJson('[1,2]')).toEqual({ ok: false, error: 'shape' });
    expect(importRulesJson('{"deck":{"count":9}}')).toEqual({ ok: false, error: 'deck.count' });
  });
});

describe('share link', () => {
  it('carries a preset and its changes, compactly', () => {
    const choice = { preset: 'quick', overrides: { assist: { showKnownCards: true } } };
    const code = encodeRulesChoice(choice);
    expect(code).toMatch(/^[\w-]+$/);
    expect(decodeRulesChoice(code)).toEqual(choice);
  });

  it('refuses what it cannot play', () => {
    expect(decodeRulesChoice('%%%')).toBeNull();
    expect(decodeRulesChoice(encodeRulesChoice({ preset: 'nope', overrides: {} }))).toBeNull();
    expect(decodeRulesChoice(encodeRulesChoice({ preset: 'classic', overrides: { deck: { count: 7 } } }))).toBeNull();
    expect(decodeRulesChoice(btoa('[]'))).toBeNull();
  });
});
