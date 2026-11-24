// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { newGame } from '../src/App.tsx';
import { HomeScreen, loadChoice } from '../src/home/HomeScreen.tsx';
import { refreshProfile, rememberedAvatar } from '../src/profile/avatar.ts';

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  refreshProfile();
});

describe('the profile', () => {
  it('is picked from the greeting and kept on the device', () => {
    render(<HomeScreen onPlay={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Bienvenue/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Ton prénom' }), { target: { value: 'Steeve' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Vermillon' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Couronne' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(rememberedAvatar()).toEqual({ color: 'vermilion', icon: 'crown' });
    expect(localStorage.getItem('tamalou-name')).toBe('Steeve');
    expect(screen.getByRole('button', { name: /Bonjour Steeve/ })).toBeTruthy();
    // The last game plays under the new name.
    expect(screen.getByRole('heading', { name: /Steeve contre/ })).toBeTruthy();
  });

  it('seats the player with their avatar; the bots are given others', () => {
    localStorage.setItem('tamalou-avatar', JSON.stringify({ color: 'blue', icon: 'heart' }));
    localStorage.setItem('tamalou-name', 'Léa');
    const conn = newGame({ ...loadChoice(), mode: 'solo', bots: 2 });
    const faces = conn.avatars?.();
    expect(faces?.get('you')).toEqual({ color: 'blue', icon: 'heart' });
    expect(faces?.get('bot1')).toEqual({ color: 'vermilion', icon: 'star' });
    expect(faces?.get('bot2')?.color).toBe('green');
    conn.dispose();
  });

  it('goes to the player of a shared table who has the device’s name', () => {
    localStorage.setItem('tamalou-avatar', JSON.stringify({ color: 'teal', icon: 'note' }));
    localStorage.setItem('tamalou-name', 'Zoé');
    const conn = newGame({ ...loadChoice(), mode: 'pass', players: ['Hugo', 'zoé'], bots: 0 });
    expect(conn.avatars?.().get('p2')).toEqual({ color: 'teal', icon: 'note' });
    expect(conn.avatars?.().get('p1')?.color).toBe('blue');
    conn.dispose();
  });
});
