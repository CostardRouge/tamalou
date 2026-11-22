import { summarizeUsage, type UsageRow } from '@tamalou/shared';
import { describe, expect, it } from 'vitest';
import { adminPage, cookie, messagePage, readSession, sessionFor, sign, unsign } from '../src/index.ts';

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
});
