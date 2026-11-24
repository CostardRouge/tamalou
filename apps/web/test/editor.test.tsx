// @vitest-environment jsdom
import { encodeRulesChoice } from '@tamalou/shared';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App.tsx';
import { openMode, playFromPanel } from './launch.ts';

afterEach(() => {
  cleanup();
  history.replaceState(null, '', '/');
});
beforeEach(() => localStorage.clear());

const openEditor = () => {
  render(<App />);
  openMode('Seul contre des bots');
  fireEvent.click(screen.getByRole('button', { name: 'Personnaliser les règles' }));
};

/** On a phone the sections are tiles: touching one opens its settings in place. */
const openSection = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

describe('the game master’s screen', () => {
  it('changes a rule, shows it in the summary and counts it on the home screen', () => {
    openEditor();
    expect(screen.queryByRole('switch', { name: 'Jokers' })).toBeNull();
    openSection('Paquet');
    const deck = screen.getByRole('region', { name: 'Paquet' });
    fireEvent.click(within(deck).getByRole('switch', { name: 'Jokers' }));
    // The tile says it in its line, and marks itself changed.
    const tile = screen.getByRole('button', { name: 'Paquet' });
    expect(tile.getAttribute('aria-expanded')).toBe('true');
    expect(within(tile).getByText(/1 paquet de 52 cartes et 2 jokers\./)).toBeTruthy();
    expect(within(tile).getByText('modifié')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Terminé' }));
    expect(screen.getByText('1 réglage modifié')).toBeTruthy();
  });

  it('applies the changed rules to the game it starts', () => {
    openEditor();
    openSection('Paquet');
    fireEvent.click(screen.getByRole('switch', { name: 'Jokers' }));
    fireEvent.click(screen.getByRole('button', { name: 'Terminé' }));
    playFromPanel();
    // 54 cards with the jokers, minus 3 × 4 dealt and the first discard (the pile is not playable yet: an image).
    expect(screen.getByRole('img', { name: 'Pioche, 41 cartes' })).toBeTruthy();
  });

  it('goes back to the preset', () => {
    openEditor();
    openSection('Paquet');
    fireEvent.click(screen.getByRole('switch', { name: 'Jokers' }));
    fireEvent.click(screen.getByRole('button', { name: 'Revenir au preset' }));
    expect(screen.getByRole('switch', { name: 'Jokers' }).getAttribute('aria-checked')).toBe('false');
  });

  it('opens one section at a time, and closes it again', () => {
    openEditor();
    openSection('Paquet');
    openSection('Main');
    expect(screen.queryByRole('region', { name: 'Paquet' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Main' })).toBeTruthy();
    openSection('Main');
    expect(screen.queryByRole('region', { name: 'Main' })).toBeNull();
  });

  it('sets a card’s points on the card itself', () => {
    openEditor();
    openSection('Valeur des cartes');
    const values = screen.getByRole('region', { name: 'Valeur des cartes' });
    fireEvent.click(within(values).getByRole('button', { name: 'Dame, 10 points' }));
    fireEvent.click(within(within(values).getByRole('group', { name: 'Dame' })).getByRole('button', { name: 'Moins' }));
    expect(within(values).getByRole('button', { name: 'Dame, 9 points' })).toBeTruthy();
    expect(within(values).getByText('Modifiée · le preset dit 10')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Terminé' }));
    expect(screen.getByText('1 réglage modifié')).toBeTruthy();
  });

  it('gives a card another power, and chooses the cards seen at the start', () => {
    openEditor();
    openSection('Pouvoirs et pioche');
    const powers = screen.getByRole('region', { name: 'Pouvoirs et pioche' });
    fireEvent.click(within(powers).getByRole('button', { name: 'Roi, Aucun' }));
    fireEvent.click(within(powers).getByRole('radio', { name: 'Échange à l’aveugle' }));
    expect(within(powers).getByRole('button', { name: 'Roi, Échange à l’aveugle' })).toBeTruthy();
    openSection('Main');
    const hand = screen.getByRole('region', { name: 'Main' });
    fireEvent.click(within(hand).getByRole('button', { name: 'Carte 1, cachée' }));
    expect(within(hand).getByRole('button', { name: 'Carte 1, vue au départ' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(within(screen.getByRole('button', { name: 'Main' })).getByText(/regarde/)).toBeTruthy();
  });

  it('exports the rules as a JSON file', () => {
    const url = vi.fn(() => 'blob:rules');
    Object.assign(URL, { createObjectURL: url, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Exporter' }));
    expect(url).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    click.mockRestore();
  });

  it('opens rules received by link, and drops the fragment', () => {
    const code = encodeRulesChoice({ preset: 'quick', overrides: { assist: { showKnownCards: true } } });
    history.replaceState(null, '', `/#rules=${code}`);
    render(<App />);
    // The panel opens on them, and the big card counts them too.
    expect(screen.getByText('Règles reçues par lien.')).toBeTruthy();
    expect(screen.getAllByText('1 réglage modifié')).toHaveLength(2);
    expect((screen.getByRole('radio', { name: /Rapide/ }) as HTMLInputElement).checked).toBe(true);
    expect(location.hash).toBe('');
  });
});
