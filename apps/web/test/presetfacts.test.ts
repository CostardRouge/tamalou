import { rulesFromPreset } from '@tamalou/shared';
import { describe, expect, it } from 'vitest';
import { presetFacts } from '../src/home/presetFacts.ts';

const classic = rulesFromPreset('classic');
const lines = (id: string, overrides = {}) =>
  presetFacts(rulesFromPreset(id, overrides), classic).map((f) => `${f.label} ${f.value}${f.changed ? ' *' : ''}`);

describe('a preset’s card on the launch screen', () => {
  it('lists the main facts of Classique, read from its rules', () => {
    expect(lines('classic')).toEqual(['Cartes 4', 'Éliminé à 100', 'Fin dernier en lice', 'Tamalou raté +10']);
  });

  it('marks what differs from Classique and keeps four lines at most, in one order', () => {
    expect(lines('quick')).toEqual(['Cartes 4', 'Éliminé à 50 *', 'Fin 1er éliminé *', 'Tamalou raté +10']);
    expect(lines('beginner')).toEqual([
      'Cartes 4',
      'Cartes vues affichées *',
      'Journal complet *',
      'Défausse racontée *',
    ]);
  });

  it('follows a game played in rounds and a doubled penalty', () => {
    expect(
      lines('classic', { gameEnd: { mode: 'rounds', rounds: 7 }, tamalou: { failPenalty: { mode: 'double' } } }),
    ).toEqual(['Cartes 4', 'Manches 7 *', 'Tamalou raté ×2 *']);
  });
});
