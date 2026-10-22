// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import pkg from '../../../package.json' with { type: 'json' };
import { App } from '../src/App.tsx';
import { updateSettings } from '../src/feedback/settings.ts';

afterEach(cleanup);

describe('the app', () => {
  it('starts a solo game from the home screen and shows the initial peek', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Tamalou' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Un adversaire de plus' }));
    fireEvent.click(screen.getByRole('button', { name: 'Jouer' }));
    expect(screen.getByText('Mémorise tes 2 cartes, elles vont se retourner.')).toBeTruthy();
    // Three opponents, four cards each, all face down; two of mine face up.
    expect(screen.getAllByRole('img', { name: /Carte \d de .*Carte face cachée/ })).toHaveLength(12);
    expect(screen.getAllByRole('img', { name: /^Ta carte \d, (?!Carte face cachée)/ })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'C’est mémorisé' }));
    expect(screen.queryByRole('button', { name: 'C’est mémorisé' })).toBeNull();
  });

  it('lays my hand out as picked in the settings, the opponents’ fans seen from across the table', () => {
    const { container } = render(<App />);
    const mine = () => container.querySelector('.mine fieldset');
    fireEvent.click(screen.getByRole('button', { name: 'Jouer' }));
    expect(mine()?.className).toBe('hand lay-row');
    fireEvent.click(screen.getByRole('button', { name: 'Affichage' }));
    fireEvent.click(screen.getByRole('radio', { name: /Éventail/ }));
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
