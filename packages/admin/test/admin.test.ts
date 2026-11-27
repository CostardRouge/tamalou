import { summarizeUsage, type UsageGame, type UsageRow, usageGames } from '@tamalou/shared';
import { describe, expect, it } from 'vitest';
import {
  adminPage,
  cookie,
  dayPage,
  exportDue,
  gamePage,
  gameTitle,
  messagePage,
  readSession,
  sessionFor,
  sign,
  unsign,
} from '../src/index.ts';

const SECRET = 'a-test-secret-of-at-least-32-characters';
const NOW = Date.parse('2026-11-22T12:00:00Z');

describe('the admin session', () => {
  it('signs a value and reads it back only with the same secret, untouched', async () => {
    const token = await sign({ a: 1 }, SECRET);
    expect(await unsign(token, SECRET)).toEqual({ a: 1 });
    expect(await unsign(token, `${SECRET}x`)).toBeNull();
    const [body, mac] = token.split('.');
    const forged = `${btoa(JSON.stringify({ a: 2 })).replaceAll('=', '')}.${mac}`;
    expect(await unsign(forged, SECRET)).toBeNull();
    expect(await unsign(`${body}`, SECRET)).toBeNull();
    expect(await unsign(`${token}.x`, SECRET)).toBeNull();
    expect(await unsign('!!.??', SECRET)).toBeNull();
    await expect(sign({}, 'short')).rejects.toThrow('32 characters');
  });

  it('keeps a session for a working day', async () => {
    const token = await sign(sessionFor('sub-1', 'Steeve', NOW), SECRET);
    expect(await readSession(token, SECRET, NOW)).toMatchObject({ sub: 'sub-1', name: 'Steeve' });
    expect(await readSession(token, SECRET, NOW + 8 * 3600 * 1000)).toBeNull();
    expect(await readSession(await sign({ sub: 1 }, SECRET), SECRET, NOW)).toBeNull();
    expect(await readSession(await sign('x', SECRET), SECRET, NOW)).toBeNull();
  });

  it('finds a cookie in a Cookie header', () => {
    expect(cookie('a=1; __Host-admin=t.k=; b=2', '__Host-admin')).toBe('t.k=');
    expect(cookie(null, 'a')).toBeNull();
    expect(cookie('a=1', 'b')).toBeNull();
  });
});

describe('the admin page', () => {
  const rows: UsageRow[] = [
    {
      day: '2026-11-22',
      report: {
        v: 1,
        event: {
          kind: 'gameStarted',
          mode: 'solo',
          players: 3,
          humans: 1,
          bots: 2,
          level: 'medium',
          preset: 'classic',
          rulesChanged: false,
        },
        ctx: {
          lang: 'fr',
          device: 'phone',
          orientation: 'portrait',
          connection: '4g',
          installed: true,
          sound: true,
          haptics: false,
          hand: 'row',
          drawView: 'held',
          botPace: 'normal',
          cardSpeed: 'normal',
        },
      },
    },
  ];

  it('shows the period, its numbers and its tallies, escaping what it prints', () => {
    const html = adminPage({
      summary: summarizeUsage(rows, '2026-11-22', 7),
      days: 7,
      who: '<Steeve>',
      version: '0.14.0',
    });
    expect(html).toContain('<b aria-current="page">7 j</b>');
    expect(html).toContain('href="?days=30"');
    expect(html).toContain('Seul contre des bots');
    expect(html).toContain('Contre des bots');
    expect(html).toContain('&lt;Steeve&gt;');
    expect(html).not.toContain('<Steeve>');
    expect(html).toContain('<b>1</b><span>parties lancées</span>');
    expect(html).toContain('Rien sur la période.');
    expect(html).toContain('v0.14.0');
    // A device setting reads as the game's settings name it.
    expect(html).toContain('>Ligne<');
    expect(html).toContain('>En main<');
  });

  it('says what went wrong on a page of its own', () => {
    const html = messagePage('Accès refusé', 'Pas pour toi.', { href: 'login', label: 'Réessayer' });
    expect(html).toContain('<h1>Accès refusé</h1>');
    expect(html).toContain('href="login"');
    expect(messagePage('A', 'B')).not.toContain('class="button"');
  });

  it('leads home and to the game, each bar to its day, each game to its page', () => {
    const timed: UsageRow[] = [
      {
        day: '2026-11-22',
        at: '2026-11-22T20:42',
        report: {
          ...(rows[0] as UsageRow).report,
          event: { ...((rows[0] as UsageRow).report.event as object), game: 'game0001' } as never,
        },
      },
    ];
    const html = adminPage({ summary: summarizeUsage(timed, '2026-11-22', 7), days: 7, who: 'S', version: '1' });
    expect(html).toContain('<a href="/">Accueil</a>');
    expect(html).toContain('<a href="/play/">Jouer</a>');
    expect(html).toContain('href="?day=2026-11-22"');
    expect(html).toContain('href="?game=game0001"');
    expect(html).toContain('<span class="t">21:42</span>');
    expect(html).toContain('Quand on joue');
    // Without a time yet, the hours say when they will come.
    expect(adminPage({ summary: summarizeUsage(rows, '2026-11-22', 7), days: 7, who: 'S', version: '1' })).toContain(
      'Les heures arrivent',
    );
  });

  it('shows one day, its neighbours and its games in order', () => {
    const html = dayPage({
      day: '2026-11-22',
      summary: summarizeUsage(rows, '2026-11-22', 1),
      prev: '2026-11-21',
      next: null,
      who: 'S',
    });
    expect(html).toContain('Dimanche 22 novembre');
    expect(html).toContain('href="?day=2026-11-21"');
    expect(html).toContain('<span class="step off">›</span>');
    expect(html).toContain('Seul contre 2 bots');
    expect(html).toContain('Pas finie');
    expect(html).toContain('href="/admin/"');
  });

  it('tells one game: when, how long, the table, the device', () => {
    const base = usageGames(rows)[0] as UsageGame;
    const game: UsageGame = {
      ...base,
      id: 'game0001',
      start: '21:42',
      end: { day: '2026-11-22', time: '21:56', rounds: 6, minutes: 14, won: true },
    };
    const html = gamePage({ game, who: 'S' });
    expect(html).toContain('Lancée à 21:42, finie à 21:56');
    expect(html).toContain('Gagnée');
    expect(html).toContain('<b>14 min</b>');
    expect(html).toContain('1 humain, 2 bots');
    expect(html).toContain('Téléphone, portrait');
    expect(html).toContain('<dd>Ligne</dd>');
    expect(html).toContain('numéro coupé');
    expect(gamePage({ game, device: { count: 3, since: '2026-11-20' }, who: 'S' })).toContain('3 parties depuis le');
    expect(gamePage({ game: { ...base, end: null }, who: 'S' })).toContain('Heure inconnue');
    expect(gameTitle({ ...base, mode: 'online', humans: 4, bots: 1 })).toBe('En ligne, 4 humains + 1 bot');
    expect(gameTitle({ ...base, mode: 'pass', humans: 3, bots: 0 })).toBe('Un appareil, 3 joueurs');
    expect(
      gamePage({
        game: { ...game, end: { ...game.end, won: false, day: '2026-11-23' } as UsageGame['end'] },
        who: 'S',
      }),
    ).toContain('Perdue');
  });
});

describe('the ladder on the admin page', () => {
  const summary = summarizeUsage([], '2026-11-22', 7);
  const page = (ladder: { players: number; lastExport: string | null }) =>
    adminPage({ summary, days: 7, who: 'S', version: '1', ladder, now: NOW });

  it('asks for an export when players exist and the last one is a week old, or none was made', () => {
    expect(exportDue({ players: 0, lastExport: null }, NOW)).toBe(false);
    expect(exportDue({ players: 3, lastExport: null }, NOW)).toBe(true);
    expect(exportDue({ players: 3, lastExport: '2026-11-20T09:00:00.000Z' }, NOW)).toBe(false);
    expect(exportDue({ players: 3, lastExport: '2026-11-14T09:00:00.000Z' }, NOW)).toBe(true);
  });

  it('shows the players, the last export, the download and the restore form', () => {
    const html = page({ players: 2, lastExport: '2026-11-14T09:00:00.000Z' });
    expect(html).toContain('<b>2</b><span>joueurs classés</span>');
    expect(html).toContain('le 14 novembre à 10:00');
    expect(html).toContain('Export à faire');
    expect(html).toContain('href="ladder.json"');
    expect(html).toContain('action="ladder/import"');
    const fresh = page({ players: 1, lastExport: '2026-11-21T09:00:00.000Z' });
    expect(fresh).toContain('joueur classé</span>');
    expect(fresh).not.toContain('Export à faire');
    expect(page({ players: 0, lastExport: null })).toContain('<b>jamais</b>');
    expect(adminPage({ summary, days: 7, who: 'S', version: '1' })).not.toContain('Classement');
  });
});
