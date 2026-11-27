// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { pageBody } from '../build/pages.ts';
import { PAGES } from '../build/site.ts';
import { offerLanguage, pageLang, preferredLang, startLanguageMenu } from '../src/landing/menu.ts';

// The static pages' language menu and band (ADR-0028): a visitor is offered their language's version, never sent to it.

const page = (lang: 'fr' | 'en') => {
  const p = PAGES.find((x) => x.kind === 'home' && x.lang === lang);
  if (!p) throw new Error('page missing');
  document.documentElement.lang = lang;
  document.body.innerHTML = pageBody(p);
};

afterEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

describe('the language menu of the site’s pages', () => {
  it('reads the page’s language from its html', () => {
    page('en');
    expect(pageLang()).toBe('en');
    document.documentElement.lang = 'tlh';
    expect(pageLang()).toBe('fr');
  });

  it('offers an English browser the English page from the French one, in English, and nothing on the English page', () => {
    expect(preferredLang('fr', ['en-US', 'fr'])).toBe('en');
    expect(preferredLang('en', ['en-US'])).toBeNull();
    expect(preferredLang('fr', ['ko'])).toBeNull();
    page('fr');
    Object.defineProperty(navigator, 'languages', { value: ['en-US'], configurable: true });
    offerLanguage('fr');
    const band = document.querySelector<HTMLElement>('.lang-offer');
    expect(band?.lang).toBe('en');
    expect(band?.textContent).toBe('Also in English →');
    expect(band?.querySelector('a')?.getAttribute('href')).toContain('en/');
    Object.defineProperty(navigator, 'languages', { value: ['fr-FR', 'fr'], configurable: true });
  });

  it('follows the language picked on this device before the browser’s', () => {
    localStorage.setItem('tamalou-lang', 'fr');
    expect(preferredLang('en', ['en-US'])).toBe('fr');
    expect(preferredLang('fr', ['en-US'])).toBeNull();
  });

  it('remembers the version chosen, or the page’s language when the game is opened from it, and closes on a touch elsewhere', () => {
    page('fr');
    startLanguageMenu('fr');
    const menu = document.querySelector('details.lang-menu') as HTMLDetailsElement;
    menu.open = true;
    const english = menu.querySelector<HTMLAnchorElement>('a[data-lang="en"]');
    english?.addEventListener('click', (e) => e.preventDefault());
    english?.click();
    expect(localStorage.getItem('tamalou-lang')).toBe('en');
    document.querySelector('main')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(menu.open).toBe(false);
    const play = document.querySelector<HTMLAnchorElement>('a[href$="play/"]');
    play?.addEventListener('click', (e) => e.preventDefault());
    play?.click();
    expect(localStorage.getItem('tamalou-lang')).toBe('fr');
  });
});
