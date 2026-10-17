// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../src/App.tsx';

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
});
