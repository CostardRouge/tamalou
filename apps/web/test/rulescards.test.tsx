// @vitest-environment jsdom
import { rulesFromPreset } from '@tamalou/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RulesCards, slidesFor } from '../src/rules/RulesCards.tsx';

afterEach(cleanup);

describe('the rules as cards', () => {
  it('gives each power of the Classique rules its own card, and marks nothing as changed', () => {
    const slides = slidesFor(rulesFromPreset('classic'));
    expect(slides.map((s) => s.title)).toEqual([
      'Ta main',
      'Ton tour',
      'Ce que valent les cartes',
      'Pouvoir · 7, 8',
      'Pouvoir · 9, 10',
      'Pouvoir · Valet',
      'Pouvoir · Dame',
      'La défausse rapide',
      'Tamalou !',
      'Fin de la partie',
      'Rythme et aide',
    ]);
    expect(slides.some((s) => s.lines.some((l) => l.changed))).toBe(false);
  });

  it('shows tonight’s values and marks what the game master changed', () => {
    const slides = slidesFor(rulesFromPreset('quick'));
    const end = slides.find((s) => s.key === 'end');
    expect(end?.lines.some((l) => l.changed && l.text.includes('50'))).toBe(true);
  });

  it('turns to the next card and back from its buttons', () => {
    render(<RulesCards rules={rulesFromPreset('classic')} />);
    expect(screen.getByText('1 / 11')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(screen.getByText('2 / 11')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Avant' }));
    expect(screen.getByText('1 / 11')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Règle 9 : Tamalou !' }));
    expect(screen.getByText('9 / 11')).toBeTruthy();
  });
});
