// @vitest-environment jsdom
import type { Scheduler } from '@tamalou/room';
import { rulesFromPreset } from '@tamalou/shared';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HUMAN_ID, LocalConnection } from '../src/connection/local.ts';
import { GameScreen } from '../src/game/GameScreen.tsx';

afterEach(cleanup);

/** A clock moved by hand: the bot gets ready, then nothing happens behind the test's back. */
class Clock implements Scheduler {
  private t = 0;
  private timers = new Map<number, { at: number; fn: () => void }>();
  private seq = 0;
  now() {
    return this.t;
  }
  setTimeout(fn: () => void, ms: number) {
    this.timers.set(++this.seq, { at: this.t + ms, fn });
    return this.seq;
  }
  clearTimeout(h: unknown) {
    this.timers.delete(h as number);
  }
  advance(ms: number) {
    const end = this.t + ms;
    for (;;) {
      const next = [...this.timers].filter(([, x]) => x.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      this.timers.delete(next[0]);
      this.t = next[1].at;
      next[1].fn();
    }
    this.t = end;
  }
}

/** A game where I start and have drawn and thrown one card. */
function oneTurnPlayed(log: 'full' | 'recent' | 'off', discardStory = false) {
  const rules = rulesFromPreset('classic', { assist: { log, discardStory } });
  for (let seed = 1; seed < 200; seed++) {
    const clock = new Clock();
    const conn = new LocalConnection({ humans: ['Moi'], bots: [{ name: 'Ada', level: 'easy' }], rules, seed }, clock);
    conn.send({ type: 'ready', by: HUMAN_ID });
    clock.advance(5000);
    if (conn.view().phase !== 'play' || conn.view().current !== HUMAN_ID) continue;
    clock.advance(5000);
    conn.send({ type: 'draw', by: HUMAN_ID, from: 'deck' });
    conn.send({ type: 'discardDrawn', by: HUMAN_ID });
    return conn;
  }
  throw new Error('no seed lets me start');
}

describe('the journal on the table', () => {
  it('opens as a sheet that tells my go and the card I threw, and closes', () => {
    const conn = oneTurnPlayed('recent');
    render(<GameScreen conn={conn} onQuit={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Journal' }));
    const journal = screen.getByRole('complementary', { name: 'Journal' });
    expect(within(journal).getByText('Le dernier tour de chacun')).toBeTruthy();
    expect(within(journal).getByText('Tu pioches.')).toBeTruthy();
    expect(within(journal).getAllByRole('img').length).toBeGreaterThan(0);
    fireEvent.click(within(journal).getByRole('button', { name: 'Agrandir le journal' }));
    expect(journal.className).toContain('journal-tall');
    fireEvent.click(within(journal).getByRole('button', { name: 'Fermer le journal' }));
    expect(screen.queryByRole('complementary', { name: 'Journal' })).toBeNull();
  });

  it('has no button when the game master plays without it', () => {
    render(<GameScreen conn={oneTurnPlayed('off')} onQuit={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Journal' })).toBeNull();
  });
});

describe('the discard laid out', () => {
  it('is not offered by default', () => {
    render(<GameScreen conn={oneTurnPlayed('recent')} onQuit={() => {}} />);
    expect(screen.queryByRole('button', { name: /^Raconter la défausse/ })).toBeNull();
  });

  it('opens from its icon beside the discard and tells each card', () => {
    render(<GameScreen conn={oneTurnPlayed('recent', true)} onQuit={() => {}} />);
    // The card the deal turned over, then mine.
    fireEvent.click(screen.getByRole('button', { name: 'Raconter la défausse : 2 cartes' }));
    const panel = screen.getByRole('dialog', { name: 'La défausse' });
    const cards = within(panel).getAllByRole('button', { pressed: false });
    expect(within(panel).getByText(/Tu l’as piochée puis jetée\./)).toBeTruthy();
    fireEvent.click(cards.at(-1) as HTMLElement);
    expect(within(panel).getByText(/Retournée à la donne\./)).toBeTruthy();
    fireEvent.click(within(panel).getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('dialog', { name: 'La défausse' })).toBeNull();
  });
});

describe('the top bar', () => {
  it('keeps the way out, the round and the journal, and puts the rest in its menu', () => {
    render(<GameScreen conn={oneTurnPlayed('recent')} onQuit={() => {}} />);
    expect(screen.getByRole('button', { name: 'Quitter la partie' })).toBeTruthy();
    expect(screen.queryByRole('menu')).toBeNull();
    const more = screen.getByRole('button', { name: 'Plus d’options' });
    fireEvent.click(more);
    const menu = screen.getByRole('menu', { name: 'Options de la partie' });
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((i) => i.textContent),
    ).toEqual(['Pause', 'Affichage', 'Règles', 'Quitter la partie']);
    // The sound switches in place, the menu stays open.
    const sound = within(menu).getByRole('menuitemcheckbox', { name: /Son/ });
    const was = sound.getAttribute('aria-checked');
    fireEvent.click(sound);
    expect(screen.getByRole('menuitemcheckbox', { name: /Son/ }).getAttribute('aria-checked')).not.toBe(was);
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /Son/ }));
    // The vibrations too.
    const haptics = screen.getByRole('menuitemcheckbox', { name: /Vibrations/ });
    const before = haptics.getAttribute('aria-checked');
    fireEvent.click(haptics);
    expect(screen.getByRole('menuitemcheckbox', { name: /Vibrations/ }).getAttribute('aria-checked')).not.toBe(before);
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /Vibrations/ }));
    // Escape closes it, and only it.
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(more);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Règles' }));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('dialog', { name: /Règles/ })).toBeTruthy();
  });
});
