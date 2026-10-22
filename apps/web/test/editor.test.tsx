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

describe('the game master’s screen', () => {
  it('changes a rule, shows it in the summary and counts it on the home screen', () => {
    openEditor();
    const deck = screen.getByText('Paquet', { selector: 'summary' }).closest('details') as HTMLElement;
    fireEvent.click(within(deck).getByRole('switch', { name: 'Jokers' }));
    expect(screen.getByText(/1 paquet de 52 cartes et 2 jokers\./)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Terminé' }));
    expect(screen.getByText('1 réglage modifié')).toBeTruthy();
  });

  it('applies the changed rules to the game it starts', () => {
    openEditor();
    fireEvent.click(screen.getByRole('switch', { name: 'Jokers' }));
    fireEvent.click(screen.getByRole('button', { name: 'Terminé' }));
    playFromPanel();
    // 54 cards with the jokers, minus 3 × 4 dealt and the first discard (the pile is not playable yet: an image).
    expect(screen.getByRole('img', { name: 'Pioche, 41 cartes' })).toBeTruthy();
  });

  it('goes back to the preset', () => {
    openEditor();
    fireEvent.click(screen.getByRole('switch', { name: 'Jokers' }));
    fireEvent.click(screen.getByRole('button', { name: 'Revenir au preset' }));
    expect(screen.getByRole('switch', { name: 'Jokers' }).getAttribute('aria-checked')).toBe('false');
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
