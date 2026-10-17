// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App.tsx';

afterEach(cleanup);
beforeEach(() => localStorage.clear());

/** Card labels on screen that show a face (a hidden card reads "Carte face cachée"). */
const faces = () =>
  screen
    .queryAllByRole('img')
    .concat(screen.queryAllByRole('button'))
    .map((el) => el.getAttribute('aria-label') ?? '')
    .filter((l) => /^(Ta carte|Carte \d)/.test(l) && !l.includes('face cachée') && !l.includes('vide'));

const startPassAndPlay = () => {
  render(<App />);
  fireEvent.click(screen.getByRole('radio', { name: 'À plusieurs, un téléphone' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Joueur 1' }), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Joueur 2' }), { target: { value: 'Ben' } });
  // No bots: the two humans alone.
  fireEvent.click(screen.getByRole('button', { name: 'Un adversaire de moins' }));
  fireEvent.click(screen.getByRole('button', { name: 'Un adversaire de moins' }));
  fireEvent.click(screen.getByRole('button', { name: 'Jouer' }));
};

describe('pass-and-play', () => {
  it('covers the screen between players and shows nothing private on the cover', () => {
    startPassAndPlay();
    expect(screen.getByRole('heading', { name: 'Passe le téléphone à Ana' })).toBeTruthy();
    expect(faces()).toEqual([]);
    expect(screen.queryByText(/Ta carte/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'C’est moi, Ana' }));
    expect(screen.getByText('Mémorise tes 2 cartes, elles vont se retourner.')).toBeTruthy();
    expect(screen.getAllByRole('img', { name: /^Ta carte \d, (?!Carte face cachée)/ })).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'C’est mémorisé' }));
    expect(screen.getByRole('heading', { name: 'Passe le téléphone à Ben' })).toBeTruthy();
    expect(screen.queryAllByRole('img', { name: /^Ta carte/ })).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'C’est moi, Ben' }));
    fireEvent.click(screen.getByRole('button', { name: 'C’est mémorisé' }));
    // Play starts with Ana: the device goes back to her.
    expect(screen.getByRole('heading', { name: 'Passe le téléphone à Ana' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'C’est moi, Ana' }));
    expect(screen.getByRole('button', { name: 'Piocher' })).toBeTruthy();
    // Quick discard is off by default on a shared device.
    expect(screen.queryByRole('button', { name: /Défausse rapide/ })).toBeNull();
  });

  it('claims a quick discard for a named player, their cards staying face down', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('radio', { name: 'À plusieurs, un téléphone' }));
    fireEvent.click(screen.getByRole('button', { name: 'Personnaliser les règles' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Défausse rapide' }));
    fireEvent.click(screen.getByRole('button', { name: 'Terminé' }));
    fireEvent.click(screen.getByRole('button', { name: 'Un adversaire de moins' }));
    fireEvent.click(screen.getByRole('button', { name: 'Un adversaire de moins' }));
    fireEvent.click(screen.getByRole('button', { name: 'Jouer' }));
    for (const who of ['Joueur 1', 'Joueur 2']) {
      fireEvent.click(screen.getByRole('button', { name: `C’est moi, ${who}` }));
      fireEvent.click(screen.getByRole('button', { name: 'C’est mémorisé' }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'C’est moi, Joueur 1' }));
    fireEvent.click(screen.getByRole('button', { name: /Défausse rapide/ }));
    expect(screen.getByText('Défausse rapide : qui réclame ?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Joueur 2' }));
    const target = screen.getByRole('button', { name: 'Carte 1 de Joueur 2, Carte face cachée' });
    fireEvent.click(target);
    // The claim went through, right or wrong: the log names Joueur 2.
    expect(screen.getByText(/Joueur 2 (défausse rapidement|se trompe)/)).toBeTruthy();
  });

  it('starts with quick discard switched off in the rules, and lets the game master switch it back on', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('radio', { name: 'À plusieurs, un téléphone' }));
    fireEvent.click(screen.getByRole('button', { name: 'Personnaliser les règles' }));
    expect(screen.getAllByText(/Pas de défausse rapide\./).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('switch', { name: 'Défausse rapide' }));
    expect(screen.getByText(/Au moins 2 s pour réagir\./)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Terminé' }));
    expect(screen.getByText('1 réglage modifié')).toBeTruthy();
  });
});
