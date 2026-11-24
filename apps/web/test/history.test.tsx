// @vitest-environment jsdom
import type { GameEvent, PlayerView } from '@tamalou/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GameConnection } from '../src/connection/types.ts';
import { RoundOver } from '../src/game/RoundOver.tsx';
import { HomeScreen } from '../src/home/HomeScreen.tsx';
import { refreshProfile } from '../src/profile/avatar.ts';
import {
  gameLine,
  historyFile,
  MAX_GAMES,
  type PlayedGame,
  playedGames,
  recordGame,
  reloadHistory,
  restoreHistory,
  summarize,
} from '../src/profile/history.ts';

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  reloadHistory();
  refreshProfile();
});

const over = (totals: Record<string, number>, winners: string[]) =>
  ({
    phase: 'gameOver',
    me: 'you',
    winners,
    lastResult: { round: 6, caller: null, callerFailed: false, scores: [], eliminated: [] },
    players: Object.entries(totals).map(([id, total]) => ({ id, name: id === 'you' ? 'Moi' : id, total })),
  }) as unknown as PlayerView;

const ended = (caller: string, failed: boolean): GameEvent => ({
  type: 'roundEnded',
  result: { round: 1, caller, callerFailed: failed, scores: [], eliminated: [] },
});

const line = (at: number, extra: Partial<PlayedGame> = {}): PlayedGame => ({
  at,
  mode: 'solo',
  place: 1,
  players: 3,
  others: ['Ada', 'Basile'],
  total: 20,
  rounds: 5,
  won: true,
  called: 1,
  made: 1,
  ...extra,
});

describe('the history', () => {
  it('reads my place, my points and my Tamalous from the end of a game', () => {
    const events = [ended('you', false), ended('Ada', false), ended('you', true)];
    expect(gameLine(over({ you: 40, Ada: 12, Basile: 71 }, ['Ada']), events, 'you', 'solo', 5)).toEqual({
      at: 5,
      mode: 'solo',
      place: 2,
      players: 3,
      others: ['Ada', 'Basile'],
      total: 40,
      rounds: 6,
      won: false,
      called: 2,
      made: 1,
    });
    expect(gameLine(over({ you: 12, Ada: 12 }, ['you', 'Ada']), [], 'you', 'online', 5)?.place).toBe(1);
    // A spectator has no seat; a game still running has no end.
    expect(gameLine(over({ Ada: 1 }, ['Ada']), [], '@table', 'online', 5)).toBeNull();
    expect(
      gameLine({ ...over({ you: 1 }, []), phase: 'playing' } as unknown as PlayerView, [], 'you', 'solo', 5),
    ).toBeNull();
  });

  it('keeps a game once, newest first, and no more than its cap', () => {
    const end: GameEvent = { type: 'gameEnded', winners: ['you'], totals: [] };
    recordGame(line(1), [end]);
    recordGame(line(1), [end]);
    expect(playedGames()).toHaveLength(1);
    recordGame(line(2), [{ ...end }]);
    expect(playedGames().map((g) => g.at)).toEqual([2, 1]);
    reloadHistory();
    expect(playedGames().map((g) => g.at)).toEqual([2, 1]);
    const many = Array.from({ length: MAX_GAMES + 5 }, (_, i) => line(100 + i));
    expect(restoreHistory(historyFile(many))).toBe(MAX_GAMES);
    expect(playedGames()).toHaveLength(MAX_GAMES);
    expect(playedGames()[0]?.at).toBe(100 + MAX_GAMES + 4);
  });

  it('brings a saved file back, adding only the games it does not have', () => {
    recordGame(line(1), [{ type: 'gameEnded', winners: [], totals: [] }]);
    const file = historyFile([line(1), line(3, { won: false, place: 2, made: 0 }), { at: 'x' } as never]);
    expect(restoreHistory(file)).toBe(1);
    expect(restoreHistory(file)).toBe(0);
    expect(restoreHistory('{"games":[]}')).toBeNull();
    expect(restoreHistory('nope')).toBeNull();
    expect(summarize(playedGames())).toEqual({ games: 2, won: 1, made: 1, since: 1 });
  });

  it('shows the counts and the last games from the home screen', () => {
    localStorage.setItem(
      'tamalou-history',
      JSON.stringify([
        line(Date.now(), { place: 1 }),
        line(1, { won: false, place: 3, mode: 'online', others: ['Zoé'] }),
      ]),
    );
    reloadHistory();
    render(<HomeScreen onPlay={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Mes parties.*2 parties · 1 gagnée/ }));
    expect(screen.getByRole('heading', { name: 'Mes parties' })).toBeTruthy();
    const items = [...document.querySelectorAll('.history-list li')];
    expect(items[0]?.textContent).toContain('1er');
    expect(items[0]?.textContent).toContain('Contre Ada, Basile');
    expect(items[1]?.textContent).toContain('3e');
    expect(items[1]?.textContent).toContain('Avec Zoé');
    expect(items[1]?.textContent).toContain('en ligne');
  });

  it('keeps a game when its end shows, once, for the player of a shared table with the device’s name', () => {
    const events: GameEvent[] = [ended('Moi', false), { type: 'gameEnded', winners: ['Moi'], totals: [] }];
    const view = { ...over({ you: 30, Zoé: 50 }, ['you']), me: 'Zoé' } as PlayerView;
    const conn = { readyForNext: () => [], events: () => events, handoff: () => null } as unknown as GameConnection;
    localStorage.setItem('tamalou-name', 'moi');
    const { unmount } = render(<RoundOver view={view} conn={conn} nameOf={(id) => id} onQuit={() => {}} />);
    unmount();
    render(<RoundOver view={view} conn={conn} nameOf={(id) => id} onQuit={() => {}} />);
    expect(playedGames()).toHaveLength(1);
    expect(playedGames()[0]).toMatchObject({ mode: 'pass', place: 1, won: true, others: ['Zoé'], total: 30 });
  });
});
