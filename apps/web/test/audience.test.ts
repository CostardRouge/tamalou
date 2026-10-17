// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analyticsConfig, analyticsTag } from '../build/analytics.ts';
import { ANALYTICS } from '../build/site.ts';

/**
 * Audience measurement (ADR-0017), tests ported with the module: the settings the build writes
 * (build/analytics.ts) and the browser module that loads the tracker and sends views and events (src/audience.ts).
 * Each test gets a fresh module, since it keeps the page's state (tracker loaded or not, last view).
 */

type Audience = typeof import('../src/audience.ts');
const URL_ = 'https://tamalou.steevepommier.com/';
/** The site has no id until the owner adds it in Umami: the build then gets it from the environment. */
const ID = { VITE_UMAMI_WEBSITE_ID: 'site-id' };
const CONFIG = analyticsConfig(ID, { production: true, url: URL_ });

async function page(opts: { config?: boolean; path?: string; title?: string } = {}): Promise<Audience> {
  const tag = opts.config === false || !CONFIG ? '' : analyticsTag(CONFIG, opts.path ?? 'jouer/');
  document.head.innerHTML = `<title>${opts.title ?? 'Tamalou'}</title>${tag}`;
  vi.resetModules();
  return import('../src/audience.ts');
}
const tracker = () => document.head.querySelector<HTMLScriptElement>('script[src]');
/** The tracker's API as Umami defines it, recording the payloads it would send. */
function fakeUmami(): Record<string, unknown>[] {
  const sent: Record<string, unknown>[] = [];
  const base = { website: 'w', hostname: 'tamalou.steevepommier.com', url: '/raw/path', referrer: '', title: 'raw' };
  window.umami = { track: (build) => sent.push(build(base)) };
  return sent;
}

beforeEach(() => {
  localStorage.clear();
  delete window.umami;
  vi.restoreAllMocks();
});
afterEach(() => {
  document.head.innerHTML = '';
});

describe('build settings', () => {
  it('measures production builds only, unless asked', () => {
    expect(analyticsConfig(ID, { production: false, url: URL_ })).toBeNull();
    expect(analyticsConfig({ ...ID, VITE_UMAMI_DEV: 'true' }, { production: false, url: URL_ })).not.toBeNull();
    expect(CONFIG).toEqual({
      src: ANALYTICS.src,
      website: 'site-id',
      domains: 'tamalou.steevepommier.com,costardrouge.github.io',
    });
  });

  it('is switched off by an empty website id, and overridden by the environment', () => {
    expect(analyticsConfig({ VITE_UMAMI_WEBSITE_ID: '' }, { production: true, url: URL_ })).toBeNull();
    // Without an id in the code, a build without the repository variable measures nothing.
    if (!ANALYTICS.websiteId) expect(analyticsConfig({}, { production: true, url: URL_ })).toBeNull();
    const custom = analyticsConfig(
      {
        VITE_UMAMI_SRC: 'https://insight.example.com/insight',
        VITE_UMAMI_WEBSITE_ID: ' id ',
        VITE_UMAMI_DOMAINS: 'A.com, b.com',
      },
      { production: true, url: URL_ },
    );
    expect(custom).toEqual({ src: 'https://insight.example.com/insight', website: 'id', domains: 'a.com,b.com' });
    expect(
      analyticsConfig({ ...ID, VITE_UMAMI_SRC: 'javascript:alert(1)' }, { production: true, url: URL_ })?.src,
    ).toBe(ANALYTICS.src);
  });

  it('lets a new canonical host report', () => {
    const moved = analyticsConfig(ID, { production: true, url: 'https://tamalou.example.com/' });
    expect(moved?.domains.split(',')).toContain('tamalou.example.com');
  });

  it('writes settings, not the tracker, with the page address from the site root', () => {
    const tag = analyticsTag({ src: 'https://x.example/i', website: 'id', domains: 'a.com' }, 'en/');
    expect(tag).toBe(
      '<script type="application/json" id="audience-settings">{"src":"https://x.example/i","website":"id","domains":"a.com","page":"/en/"}</script>',
    );
    const hostile = analyticsTag({ src: '</script><script>alert(1)', website: 'id', domains: '' }, '');
    expect(hostile.match(/<\/script>/g)).toHaveLength(1);
  });
});

describe('loading the tracker', () => {
  it('does nothing without settings', async () => {
    const a = await page({ config: false });
    expect(a.measurement()).toBe('none');
    a.startAnalytics();
    a.trackView('/jouer/');
    expect(tracker()).toBeNull();
  });

  it('appends it asynchronously, automatic tracking off, search and fragment excluded', async () => {
    const a = await page();
    expect(a.measurement()).toBe('on');
    a.startAnalytics();
    a.startAnalytics();
    const script = tracker();
    expect(document.head.querySelectorAll('script[src]')).toHaveLength(1);
    expect(script?.src).toBe(ANALYTICS.src);
    expect(script?.async).toBe(true);
    expect(script?.dataset).toMatchObject({
      websiteId: 'site-id',
      domains: 'tamalou.steevepommier.com,costardrouge.github.io',
      autoTrack: 'false',
      doNotTrack: 'true',
      excludeSearch: 'true',
      excludeHash: 'true',
    });
  });

  it('never loads it for a visitor who switched it off', async () => {
    localStorage.setItem('umami.disabled', '1');
    const a = await page();
    expect(a.measurement()).toBe('off');
    a.startAnalytics();
    expect(tracker()).toBeNull();
  });

  it('never loads it when the browser sends Global Privacy Control or Do Not Track', async () => {
    const a = await page();
    const signal = (key: string, value: unknown) =>
      Object.defineProperty(navigator, key, { value, configurable: true });
    try {
      signal('globalPrivacyControl', true);
      expect(a.privacySignal()).toBe(true);
      expect(a.measurement()).toBe('signal');
      a.startAnalytics();
      expect(tracker()).toBeNull();
      signal('globalPrivacyControl', false);
      signal('doNotTrack', '1');
      expect(a.measurement()).toBe('signal');
      signal('doNotTrack', null);
      expect(a.measurement()).toBe('on');
    } finally {
      delete (navigator as unknown as Record<string, unknown>).globalPrivacyControl;
      delete (navigator as unknown as Record<string, unknown>).doNotTrack;
    }
  });
});

describe('views and events', () => {
  it('waits for the tracker, then sends clean addresses, each view once, the previous one as referrer', async () => {
    const a = await page();
    a.startAnalytics();
    a.trackView('/jouer/');
    a.trackView('/jouer/');
    a.trackView('/jouer/partie');
    a.trackEvent('game-started', { mode: 'solo' });
    const sent = fakeUmami();
    expect(sent).toHaveLength(0);
    tracker()?.dispatchEvent(new Event('load'));
    expect(sent).toHaveLength(3);
    expect(sent[0]).toMatchObject({ url: '/jouer/', referrer: '', website: 'w' });
    expect(sent[1]).toMatchObject({ url: '/jouer/partie', referrer: '/jouer/' });
    expect(sent[2]).toMatchObject({ url: '/jouer/partie', name: 'game-started', data: { mode: 'solo' } });
    a.trackView('/jouer/salle');
    expect(sent[3]).toMatchObject({ url: '/jouer/salle', referrer: '/jouer/partie' });
  });

  it('reports the page’s own title, read once', async () => {
    const a = await page({ title: 'Tamalou' });
    a.startAnalytics();
    document.title = 'Something else';
    a.trackView('/jouer/salle');
    a.trackEvent('room-created');
    const sent = fakeUmami();
    tracker()?.dispatchEvent(new Event('load'));
    expect(sent.map((p) => p.title)).toEqual(['Tamalou', 'Tamalou']);
  });

  it('knows the page it is on', async () => {
    const a = await page({ path: 'mentions-legales/' });
    expect(a.pagePath()).toBe('/mentions-legales/');
    a.startAnalytics();
    a.trackPage();
    const sent = fakeUmami();
    tracker()?.dispatchEvent(new Event('load'));
    expect(sent[0]).toMatchObject({ url: '/mentions-legales/' });
  });

  it('drops everything when the tracker fails to load, or when the visitor opts out', async () => {
    const a = await page();
    a.startAnalytics();
    a.trackView('/jouer/');
    const sent = fakeUmami();
    tracker()?.dispatchEvent(new Event('error'));
    tracker()?.dispatchEvent(new Event('load'));
    a.trackView('/jouer/partie');
    expect(sent).toHaveLength(0);

    const b = await page();
    b.startAnalytics();
    const later = fakeUmami();
    tracker()?.dispatchEvent(new Event('load'));
    b.trackView('/');
    b.setOptOut(true);
    expect(localStorage.getItem('umami.disabled')).toBe('1');
    b.trackView('/en/');
    expect(later).toHaveLength(1);
    b.setOptOut(false);
    expect(localStorage.getItem('umami.disabled')).toBeNull();
    expect(b.measurement()).toBe('on');
  });

  it('keeps a bounded queue while the tracker is away', async () => {
    const a = await page();
    a.startAnalytics();
    for (let i = 0; i < 100; i++) a.trackView(`/jouer/${i}`);
    const sent = fakeUmami();
    tracker()?.dispatchEvent(new Event('load'));
    expect(sent.length).toBeLessThanOrEqual(30);
  });
});
