/** Where the game keeps its language on this device; tiny on purpose, so the static pages can set it without the dictionaries. */
export const LANG_KEY = 'tamalou-lang';

/** Remembers a language for the next time the game opens; a refused storage just forgets. */
export function rememberLang(lang: 'fr' | 'en'): void {
  try {
    globalThis.localStorage?.setItem(LANG_KEY, lang);
  } catch {
    // Not remembered: the next visit starts in French.
  }
}
