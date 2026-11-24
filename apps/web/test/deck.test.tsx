// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DeckPicker } from '../src/cards/DeckPicker.tsx';
import { BACK_HEX, BACK_INK, cleanMark, DEFAULT_DECK, readDeck } from '../src/cards/deck.ts';
import { getSettings, updateSettings } from '../src/feedback/settings.ts';

afterEach(() => {
  cleanup();
  updateSettings({ deck: DEFAULT_DECK });
});

const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => channel(Number.parseInt(hex.slice(i, i + 2), 16)));
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
};
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
};

describe('the cards’ style', () => {
  it('keeps the mark readable on every back colour', () => {
    for (const hex of Object.values(BACK_HEX)) expect(contrast(hex, BACK_INK)).toBeGreaterThanOrEqual(4.5);
  });

  it('reads a stored style part by part and keeps two characters at most', () => {
    expect(readDeck(null)).toEqual(DEFAULT_DECK);
    expect(readDeck({ color: 'night', pattern: 'nope', mark: 'ABC', effect: 'holo' })).toEqual({
      color: 'night',
      pattern: 'stripes',
      mark: 'AB',
      effect: 'holo',
    });
    expect(cleanMark(' 🃏♠x ')).toBe('🃏♠');
    expect(cleanMark('')).toBe('');
  });

  it('is picked in the settings and draws the cards at once', () => {
    const { container } = render(<DeckPicker name="t" />);
    fireEvent.click(screen.getByRole('radio', { name: 'Nuit' }));
    fireEvent.click(screen.getByRole('radio', { name: /Pois/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'Holo' }));
    fireEvent.change(screen.getByRole('textbox', { name: /Au milieu du dos/ }), { target: { value: 'SP' } });
    expect(getSettings().deck).toEqual({ color: 'night', pattern: 'dots', mark: 'SP', effect: 'holo' });
    const back = container.querySelector('.deck-preview .classic-back');
    expect(back?.className).toContain('pat-dots');
    expect(back?.className).toContain('fx-holo');
    expect(back?.textContent).toBe('SP');
    // The holographic foil covers the court cards too, not the others.
    expect(container.querySelectorAll('.deck-preview .classic-face.foil')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Revenir aux cartes classiques' }));
    expect(getSettings().deck).toEqual(DEFAULT_DECK);
  });
});
