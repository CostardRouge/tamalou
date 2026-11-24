// @vitest-environment jsdom
import { parseUsageReport } from '@tamalou/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { endGame, reportUsage, setUsageAvailable, startGame, usageContext } from '../src/usage.ts';

const sent: unknown[] = [];
beforeEach(() => {
  sent.length = 0;
  localStorage.clear();
  Object.defineProperty(navigator, 'sendBeacon', {
    configurable: true,
    value: (_url: string, body: Blob) => {
      void body.text().then((t) => sent.push(JSON.parse(t)));
      return true;
    },
  });
});
afterEach(() => setUsageAvailable(false));
const flush = () => new Promise((r) => setTimeout(r, 0));

const game = {
  mode: 'solo' as const,
  players: 3,
  humans: 1,
  bots: 2,
  level: 'medium' as const,
  preset: 'classic',
  rulesChanged: false,
};

describe('usage reports from the browser', () => {
  it('describes the device in words the server accepts, never more', () => {
    const ctx = usageContext();
    expect(parseUsageReport({ v: 1, event: { kind: 'roomCreated' }, ctx })?.ctx).toEqual(ctx);
    expect(Object.keys(ctx).sort()).toEqual(
      [
        'botPace',
        'cardSpeed',
        'connection',
        'device',
        'drawView',
        'hand',
        'haptics',
        'installed',
        'lang',
        'orientation',
        'sound',
      ].sort(),
    );
  });

  it('waits to know where it may send, then sends or drops what waited', async () => {
    setUsageAvailable(false);
    reportUsage({ kind: 'roomCreated' });
    await flush();
    expect(sent).toHaveLength(0);
    setUsageAvailable(true);
    reportUsage({ kind: 'roomJoined', via: 'qr' });
    await flush();
    expect(sent).toMatchObject([{ v: 1, event: { kind: 'roomJoined', via: 'qr' } }]);
  });

  it('sends nothing to a visitor who switched the counting off', async () => {
    setUsageAvailable(true);
    localStorage.setItem('umami.disabled', '1');
    reportUsage({ kind: 'roomCreated' });
    await flush();
    expect(sent).toHaveLength(0);
  });

  it('tells a game from its start to its end, its length in minutes, a win only for solo', async () => {
    setUsageAvailable(true);
    startGame(game, true, 0);
    endGame(5, true, 12 * 60_000);
    await flush();
    expect(sent).toMatchObject([
      { event: { kind: 'gameStarted', mode: 'solo', bots: 2 } },
      { event: { kind: 'gameEnded', mode: 'solo', players: 3, rounds: 5, minutes: 12, won: true } },
    ]);
    // One number ties the start to the end, a new one for every game, and the server accepts it.
    const [a, b] = sent as { event: { game: string } }[];
    expect(a?.event.game).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(b?.event.game).toBe(a?.event.game);
    expect(parseUsageReport(sent[0])).not.toBeNull();
    sent.length = 0;
    startGame({ ...game, mode: 'online', humans: 3, bots: 0, players: 3, level: null }, true, 0);
    endGame(2, true, 60_000);
    await flush();
    expect(sent[1]).toMatchObject({ event: { kind: 'gameEnded', mode: 'online', won: null } });
    sent.length = 0;
    // A room's other players tell nothing: the game master's device does.
    startGame({ ...game, mode: 'online' }, false, 0);
    endGame(2, false, 60_000);
    endGame(2, false, 60_000);
    await flush();
    expect(sent).toHaveLength(0);
  });

  it('falls back to a kept-alive request when the browser has no beacon', async () => {
    Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: undefined });
    const fetchSpy = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal('fetch', fetchSpy);
    setUsageAvailable(true);
    reportUsage({ kind: 'roomCreated' });
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/usage$/),
      expect.objectContaining({ keepalive: true }),
    );
    vi.unstubAllGlobals();
  });
});
