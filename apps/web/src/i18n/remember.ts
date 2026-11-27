import type { Lang } from '@tamalou/shared/languages';

/** Where the game keeps its language on this device; tiny on purpose, so the static pages can set it without the dictionaries. */
export const LANG_KEY = 'tamalou-lang';

/** The development pseudo-language (`?lang=xx-long`, i18n/pseudo.ts): never offered, never remembered. */
export const PSEUDO = 'xx-long';

/** Remembers a language for the next time the game opens; a refused storage just forgets. */
export function rememberLang(lang: Lang): void {
  try {
    globalThis.localStorage?.setItem(LANG_KEY, lang);
  } catch {
    // Not remembered: the next visit goes by the browser's languages again.
  }
}

/** The language picked by hand on this device, if any (not checked: the caller knows which it can show). */
export function storedLang(): string | null {
  try {
    return globalThis.localStorage?.getItem(LANG_KEY) ?? null;
  } catch {
    return null;
  }
}
