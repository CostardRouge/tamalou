import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en.ts';
import { fr } from '../src/i18n/fr.ts';
import { cardName, plural, rankShort, setLang, t } from '../src/i18n/index.ts';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('dictionaries', () => {
  it('have the same keys and the same placeholders in French and English', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
    for (const key of Object.keys(fr) as (keyof typeof fr)[]) {
      expect(placeholders(en[key]), key).toEqual(placeholders(fr[key]));
    }
  });

  it('fill placeholders, count in French and name cards', () => {
    setLang('fr');
    expect(t('turnOf', { name: 'Ada' })).toBe('Au tour de Ada');
    expect(plural('points', 0)).toBe('0 point');
    expect(plural('points', 1)).toBe('1 point');
    expect(plural('points', 12)).toBe('12 points');
    expect(cardName({ rank: 'Q', suit: 'H' })).toBe('Dame de cœur');
    expect(cardName({ rank: 'JOKER', suit: null })).toBe('Joker');
    expect(rankShort({ rank: 'K' })).toBe('R');
    setLang('en');
    expect(plural('points', 0)).toBe('0 points');
    expect(rankShort({ rank: 'K' })).toBe('K');
    setLang('fr');
  });
});
