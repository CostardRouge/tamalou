import { detectLang, isReadyLang, LANGUAGES, type ReadyLang } from '@tamalou/shared/languages';
import { rememberLang, storedLang } from '../i18n/remember.ts';

// What the site's static pages (the home pages, the legal notices) do with languages, besides their words: the
// language menu closes on a touch elsewhere, the language a visitor moves to or plays in is remembered for the game,
// and a home page offers its version in the visitor's language when it has one. Never a redirection (ADR-0028): it
// would mislead search robots and surprise whoever opens a shared link.

/** The page's language, from its `<html lang>` (pt-BR is `pt`, the Chinese keep their script). */
export function pageLang(): ReadyLang {
  const html = document.documentElement.lang;
  const code = LANGUAGES.find((l) => l.html === html)?.code;
  return isReadyLang(code) ? code : 'fr';
}

/** The language this visitor would rather read, if it is not the page's: the one picked on this device, else the browser's. */
export function preferredLang(
  page: ReadyLang,
  browser: readonly string[] = navigator.languages ?? [],
): ReadyLang | null {
  const stored = storedLang();
  const wanted = isReadyLang(stored) ? stored : detectLang(browser);
  return isReadyLang(wanted) && wanted !== page ? wanted : null;
}

/** Closes the menu on a touch outside it or on Escape; remembers the language of a version or of the game opened from here. */
export function startLanguageMenu(page: ReadyLang, onPick?: (lang: ReadyLang) => void): void {
  const menu = document.querySelector<HTMLDetailsElement>('details.lang-menu');
  document.addEventListener('click', (e) => {
    const target = e.target as Element;
    if (menu?.open && !menu.contains(target)) menu.open = false;
    const a = target.closest<HTMLAnchorElement>('a[href]');
    if (!a) return;
    // The game opens in the language of the page the visitor played from, or moved to.
    const to = a.dataset.lang ?? (/play\/$/.test(a.getAttribute('href') ?? '') ? page : null);
    if (!isReadyLang(to)) return;
    rememberLang(to);
    onPick?.(to);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu?.open) {
      menu.open = false;
      menu.querySelector('summary')?.focus();
    }
  });
}

/**
 * On a home page whose language is not the visitor's: a discreet band under the header, in the visitor's language
 * («Also in English»), that leads to that version.
 */
export function offerLanguage(page: ReadyLang): void {
  const lang = preferredLang(page);
  const link = lang && document.querySelector<HTMLAnchorElement>(`details.lang-menu a[data-lang="${lang}"]`);
  const l = LANGUAGES.find((x) => x.code === lang);
  if (!link || !l) return;
  const band = document.createElement('p');
  band.className = 'lang-offer wrap';
  band.lang = l.html;
  const go = document.createElement('a');
  go.href = link.href;
  go.hreflang = l.hreflang;
  go.dataset.lang = l.code;
  go.textContent = `${l.offer} →`;
  band.append(go);
  document.querySelector('header.nav')?.after(band);
}
