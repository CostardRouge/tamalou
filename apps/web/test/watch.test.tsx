// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { getSettings, updateSettings } from '../src/feedback/settings.ts';
import { HandWatch } from '../src/game/HandWatch.tsx';
import { handKind, PACE_FACTOR, SPEED_FACTOR } from '../src/game/pace.ts';

afterEach(() => {
  cleanup();
  updateSettings({ botPace: 'normal', showHands: true, cardSpeed: 'normal', drawView: 'held' });
});

describe('watching the others', () => {
  it('sets the bots’ pace, their hands and the cards’ speed for this device', () => {
    render(<HandWatch name="w" />);
    expect(screen.getByText('Le temps de voir chaque geste, sans attendre.')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Posé' }));
    expect(getSettings().botPace).toBe('slow');
    expect(screen.getByText('Ils prennent leur temps : on suit chaque hésitation.')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Montrer la main des autres' }));
    expect(getSettings().showHands).toBe(false);
    fireEvent.click(screen.getByRole('radio', { name: 'Douce' }));
    expect(getSettings().cardSpeed).toBe('soft');
  });

  it('shows my drawn card held above my hand, or large on the table', () => {
    render(<HandWatch name="w" />);
    expect(screen.getByRole('radio', { name: 'En main' })).toHaveProperty('checked', true);
    expect(screen.getByText('Tenue juste au-dessus de tes cartes : tu gardes la table en vue.')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'En grand' }));
    expect(getSettings().drawView).toBe('big');
    expect(screen.getByText('En grand au milieu, la table assombrie : tu te concentres sur elle.')).toBeTruthy();
  });

  it('slows the bots and the cards down, or speeds them up, around the level’s own pace', () => {
    expect(PACE_FACTOR.fast).toBeLessThan(PACE_FACTOR.normal);
    expect(PACE_FACTOR.slow).toBeGreaterThan(PACE_FACTOR.normal);
    expect(SPEED_FACTOR.soft).toBeLessThan(1);
    // jsdom has no fine pointer: a touch screen's fingertip.
    expect(handKind()).toBe('finger');
  });
});
