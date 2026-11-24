// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import pkg from '../../../package.json' with { type: 'json' };
import { App } from '../src/App.tsx';
import { updateSettings } from '../src/feedback/settings.ts';
import { openMode, panel, playFromPanel } from './launch.ts';

afterEach(cleanup);
beforeEach(() => localStorage.clear());

describe('the app', () => {
  it('starts a solo game from the home screen and shows the initial peek', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Tamalou' })).toBeTruthy();
    openMode('Seul contre des bots');
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un bot' }));
    playFromPanel();
    expect(screen.getByText('Mémorise tes 2 cartes, elles vont se retourner.')).toBeTruthy();
    // Three opponents, four cards each, all face down; two of mine face up.
    expect(screen.getAllByRole('img', { name: /Carte \d de .*Carte face cachée/ })).toHaveLength(12);
    expect(screen.getAllByRole('img', { name: /^Ta carte \d, (?!Carte face cachée)/ })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'C’est mémorisé' }));
    expect(screen.queryByRole('button', { name: 'C’est mémorisé' })).toBeNull();
  });

  it('seats up to ten, and asks for two decks when the cards cannot go round', () => {
    render(<App />);
    openMode('Seul contre des bots');
    while (screen.queryByRole('button', { name: 'Ajouter un bot' }))
      fireEvent.click(screen.getByRole('button', { name: 'Ajouter un bot' }));
    // Nine bots and me: the table is full.
    expect(screen.getByText('Isidore')).toBeTruthy();
    playFromPanel();
    expect(screen.getAllByRole('img', { name: /Carte \d de .*Carte face cachée/ })).toHaveLength(36);
    cleanup();
    // Ten hands of eight do not fit one deck: "Rejouer" opens the panel, which says so, and "Jouer" waits.
    const ten = { mode: 'solo', name: '', players: ['', ''], bots: 9, level: 'easy', preset: 'classic' };
    localStorage.setItem('tamalou-solo', JSON.stringify({ ...ten, overrides: { hand: { size: 8 } } }));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Rejouer' }));
    expect(within(panel()).getByText(/Pas assez de cartes pour 10 joueurs/)).toBeTruthy();
    expect(within(panel()).getByRole('button', { name: 'Jouer' }).hasAttribute('disabled')).toBe(true);
  });

  it('pauses behind a curtain, by the button or when the player leaves the app, and resumes', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Jouer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Plus d’options' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Pause' }));
    const curtain = screen.getByRole('dialog', { name: 'Pause' });
    expect(within(curtain).getByRole('button', { name: 'Voir les règles' })).toBeTruthy();
    fireEvent.click(within(curtain).getByRole('button', { name: 'Reprendre' }));
    expect(screen.queryByRole('dialog', { name: 'Pause' })).toBeNull();
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    fireEvent(document, new Event('visibilitychange'));
    expect(screen.getByRole('dialog', { name: 'Pause' })).toBeTruthy();
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    fireEvent.click(screen.getByRole('button', { name: 'Reprendre' }));
    expect(screen.queryByRole('dialog', { name: 'Pause' })).toBeNull();
  });

  it('lays my hand out as picked in the settings, the opponents’ fans seen from across the table', () => {
    const { container } = render(<App />);
    const mine = () => container.querySelector('.mine fieldset');
    // A first visit: the default game, played from the big card in one touch.
    fireEvent.click(screen.getByRole('button', { name: 'Jouer' }));
    expect(mine()?.className).toBe('hand lay-row');
    fireEvent.click(screen.getByRole('button', { name: 'Plus d’options' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Affichage' }));
    // «Fermer» takes the focus when the panel opens, and only then: a setting changed further down keeps it, so
    // a long panel does not jump back to its top (the owner's report, 2026-11-24).
    expect(document.activeElement?.textContent).toBe('Fermer');
    const fan = screen.getByRole('radio', { name: /Éventail/ });
    fan.focus();
    fireEvent.click(fan);
    expect(document.activeElement).toBe(fan);
    expect(mine()?.className).toBe('hand lay-fan');
    expect(container.querySelector('.opponents fieldset')?.className).toBe('hand lay-fan lay-across');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Les adversaires aussi' }));
    expect(container.querySelector('.opponents fieldset')?.className).toBe('grid hand lay-grid');
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('dialog', { name: 'Affichage' })).toBeNull();
    updateSettings({ hand: 'row', oppHand: true });
  });

  it('shows the release it was built from on the home screen', () => {
    render(<App />);
    expect(screen.getByText(`v${pkg.version}`)).toBeTruthy();
  });

  it('links back to the site’s home page, in the game’s language', () => {
    render(<App />);
    const link = screen.getByRole('link', { name: 'Découvrir le jeu et ses règles' });
    expect(link.getAttribute('href')).toBe('../');
  });
});
