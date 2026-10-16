import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RULES,
  mergeRuleInputs,
  PRESETS,
  parseRules,
  RULESET_VERSION,
  rulesFromPreset,
  safeParseRules,
} from '../src/index.ts';

describe('RuleSet defaults', () => {
  it('are the "Classique" rules of the brief', () => {
    const r = DEFAULT_RULES;
    expect(r.version).toBe(RULESET_VERSION);
    expect(r.deck).toEqual({ count: 1, jokers: false, jokersPerDeck: 2 });
    expect(r.values.byRank).toMatchObject({ A: 1, '7': 7, '10': 10, J: 10, Q: 10, K: 10, JOKER: -1 });
    expect(r.values.overrides).toEqual([{ rank: 'K', suits: ['H', 'D'], value: 0 }]);
    expect(r.hand).toEqual({ size: 4, columns: 2, initialPeek: { mode: 'fixed', count: 2, slots: [2, 3] } });
    expect(r.powers.byRank).toMatchObject({
      '6': 'none',
      '7': 'peekOwn',
      '8': 'peekOwn',
      '9': 'peekOther',
      '10': 'peekOther',
      J: 'blindSwap',
      Q: 'peekThenSwap',
      K: 'none',
    });
    expect(r.powers.activation).toBe('drawPile');
    expect(r.discardPickup.mustSwap).toBe(true);
    expect(r.quickDiscard).toEqual({ enabled: true, penaltyCards: 1, allowOpponentCards: false, minWindowMs: 2000 });
    expect(r.tamalou).toEqual({
      timing: 'startOfTurn',
      lockCallerCards: true,
      failPenalty: { mode: 'add', amount: 10 },
      winBonus: 'none',
      minTurnsBeforeCall: 0,
    });
    expect(r.gameEnd).toMatchObject({ mode: 'threshold', threshold: 100, thresholdEnd: 'lastStanding' });
    expect(r.pace.turnTimerSeconds).toBe(0);
    expect(r.assist.showKnownCards).toBe(false);
  });

  it('fill everything a partial input leaves out, down to one rank', () => {
    const r = parseRules({ values: { byRank: { Q: 12 } }, powers: { byRank: { K: 'peekOther' } } });
    expect(r.values.byRank.Q).toBe(12);
    expect(r.values.byRank.J).toBe(10);
    expect(r.powers.byRank.K).toBe('peekOther');
    expect(r.powers.byRank.J).toBe('blindSwap');
  });

  it('refuse what cannot be played', () => {
    expect(safeParseRules({ hand: { size: 4, initialPeek: { slots: [2, 7] } } }).success).toBe(false);
    expect(safeParseRules({ hand: { size: 4, initialPeek: { slots: [2, 2] } } }).success).toBe(false);
    expect(safeParseRules({ hand: { size: 2, initialPeek: { count: 3 } } }).success).toBe(false);
    expect(safeParseRules({ powers: { byRank: { K: 'teleport' } } }).success).toBe(false);
    expect(safeParseRules({ version: 2 }).success).toBe(false);
    expect(safeParseRules({ deck: { count: 3 } }).success).toBe(false);
  });

  it('survive a JSON round trip (export, import, share by link)', () => {
    const r = parseRules({ tamalou: { failPenalty: { mode: 'double' } } });
    expect(parseRules(JSON.parse(JSON.stringify(r)))).toEqual(r);
  });
});

describe('presets', () => {
  it('are partial rules merged with the defaults', () => {
    expect(rulesFromPreset('classic')).toEqual(DEFAULT_RULES);
    const quick = rulesFromPreset('quick');
    expect(quick.gameEnd).toMatchObject({ threshold: 50, thresholdEnd: 'firstElimination' });
    expect(quick.hand).toEqual(DEFAULT_RULES.hand);
    expect(rulesFromPreset('beginner').assist.showKnownCards).toBe(true);
    for (const p of PRESETS) expect(() => rulesFromPreset(p.id)).not.toThrow();
  });

  it('take the game master’s changes on top', () => {
    const r = rulesFromPreset('quick', { gameEnd: { threshold: 70 } });
    expect(r.gameEnd).toMatchObject({ threshold: 70, thresholdEnd: 'firstElimination' });
    expect(() => rulesFromPreset('nope')).toThrow();
  });

  it('merge deeply, later layers winning, arrays replaced', () => {
    expect(
      mergeRuleInputs({ hand: { size: 5, initialPeek: { slots: [0, 1] } } }, { hand: { initialPeek: { slots: [3] } } }),
    ).toEqual({
      hand: { size: 5, initialPeek: { slots: [3] } },
    });
  });
});
