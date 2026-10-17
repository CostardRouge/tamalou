import { DEFAULT_RULES, parseRules, rulesFromPreset } from '@tamalou/shared';
import { describe, expect, it } from 'vitest';
import { setLang } from '../src/i18n/index.ts';
import { getAt, SECTIONS, setAt } from '../src/rules/fields.ts';
import { summarize } from '../src/rules/summary.ts';

setLang('fr');
const text = (r = DEFAULT_RULES) =>
  summarize(r)
    .flatMap((s) => s.lines.map((l) => l.text))
    .join('\n');

describe('rule settings', () => {
  it('cover every leaf of the RuleSet', () => {
    const covered = SECTIONS.flatMap((s) => s.fields.map((f) => f.path.join('.')));
    const leaves = (o: object, prefix: string[] = []): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        k === 'version'
          ? []
          : v && typeof v === 'object' && !Array.isArray(v) && !['byRank'].includes(k)
            ? leaves(v, [...prefix, k])
            : [[...prefix, k].join('.')],
      );
    for (const leaf of leaves(DEFAULT_RULES)) expect(covered, leaf).toContain(leaf);
  });

  it('change one value and keep everything else', () => {
    const r = setAt(DEFAULT_RULES, ['tamalou', 'failPenalty', 'amount'], 20);
    expect(r?.tamalou.failPenalty).toEqual({ mode: 'add', amount: 20 });
    expect(r?.hand).toEqual(DEFAULT_RULES.hand);
    expect(getAt(DEFAULT_RULES, ['gameEnd', 'threshold'])).toBe(100);
  });

  it('keep the initial peek consistent with the hand', () => {
    const smaller = setAt(DEFAULT_RULES, ['hand', 'size'], 3);
    expect(smaller?.hand.initialPeek).toMatchObject({ slots: [2], count: 1 });
    const fixed = setAt(DEFAULT_RULES, ['hand', 'initialPeek', 'slots'], [0, 1, 3]);
    expect(fixed?.hand.initialPeek.count).toBe(3);
  });

  it('refuse what the schema refuses', () => {
    expect(setAt(DEFAULT_RULES, ['deck', 'count'], 5)).toBeNull();
    expect(setAt(DEFAULT_RULES, ['powers', 'byRank', 'K'], 'teleport')).toBeNull();
  });
});

describe('rules summary', () => {
  it('reads the Classique rules in a few French lines, none flagged', () => {
    expect(text()).toContain('1 paquet de 52 cartes, sans joker.');
    expect(text()).toContain('Roi (♥ ♦) : 0');
    expect(text()).toContain('Chacun regarde ses 2 cartes du bas au départ.');
    expect(text()).toContain('7, 8 : Regarder une de ses cartes');
    expect(text()).toContain('Tamalou raté (égalité comprise) : +10 points.');
    expect(text()).toContain('Éliminé à 100 points.');
    expect(summarize(DEFAULT_RULES).every((s) => s.lines.every((l) => !l.changed))).toBe(true);
  });

  it('says and flags what differs', () => {
    const r = rulesFromPreset('quick', { deck: { jokers: true }, quickDiscard: { enabled: false } });
    expect(text(r)).toContain('1 paquet de 52 cartes et 2 jokers.');
    expect(text(r)).toContain('Pas de défausse rapide.');
    expect(text(r)).toContain('La partie s’arrête au premier éliminé, le plus petit total gagne.');
    const flagged = summarize(r).flatMap((s) => s.lines.filter((l) => l.changed).map((l) => l.text));
    expect(flagged).toContain('Éliminé à 50 points.');
    const rounds = parseRules({
      gameEnd: { mode: 'rounds', rounds: 1 },
      hand: { initialPeek: { mode: 'choose', count: 1 } },
    });
    expect(text(rounds)).toContain('1 manche, le plus petit total gagne.');
    expect(text(rounds)).toContain('Chacun choisit 1 carte à regarder au départ.');
  });
});
