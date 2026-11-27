// The languages Tamalou speaks (ADR-0028, docs/plans/languages.md § 2.2): one list, read by the game, the site's
// build, the usage statistics' schema and the tests. French is the source of every text; a language reaches players
// (the language list, the detection, its pages) only once `ready`: complete and reviewed. Pure data, no DOM.

export const LANGUAGES = [
  {
    code: 'fr',
    name: 'Français',
    dir: '',
    html: 'fr',
    hreflang: 'fr',
    ogLocale: 'fr_FR',
    locale: 'fr-FR',
    script: 'latin',
    offer: 'Aussi en français',
    ready: true,
  },
  {
    code: 'en',
    name: 'English',
    dir: 'en/',
    html: 'en',
    hreflang: 'en',
    ogLocale: 'en_US',
    locale: 'en-US',
    script: 'latin',
    offer: 'Also in English',
    ready: true,
  },
  {
    code: 'es',
    name: 'Español',
    dir: 'es/',
    html: 'es',
    hreflang: 'es',
    ogLocale: 'es_ES',
    locale: 'es',
    script: 'latin',
    offer: 'También en español',
    ready: false,
  },
  {
    code: 'it',
    name: 'Italiano',
    dir: 'it/',
    html: 'it',
    hreflang: 'it',
    ogLocale: 'it_IT',
    locale: 'it-IT',
    script: 'latin',
    offer: 'Anche in italiano',
    ready: false,
  },
  {
    code: 'pt',
    name: 'Português',
    dir: 'pt/',
    html: 'pt-BR',
    hreflang: 'pt',
    ogLocale: 'pt_BR',
    locale: 'pt-BR',
    script: 'latin',
    offer: 'Também em português',
    ready: false,
  },
  {
    code: 'de',
    name: 'Deutsch',
    dir: 'de/',
    html: 'de',
    hreflang: 'de',
    ogLocale: 'de_DE',
    locale: 'de-DE',
    script: 'latin',
    offer: 'Auch auf Deutsch',
    ready: false,
  },
  {
    code: 'ja',
    name: '日本語',
    dir: 'ja/',
    html: 'ja',
    hreflang: 'ja',
    ogLocale: 'ja_JP',
    locale: 'ja-JP',
    script: 'ja',
    offer: '日本語版もあります',
    ready: false,
  },
  {
    code: 'zh-Hans',
    name: '简体中文',
    dir: 'zh-hans/',
    html: 'zh-Hans',
    hreflang: 'zh-Hans',
    ogLocale: 'zh_CN',
    locale: 'zh-Hans-CN',
    script: 'zh-Hans',
    offer: '也有简体中文版',
    ready: false,
  },
  {
    code: 'zh-Hant',
    name: '繁體中文',
    dir: 'zh-hant/',
    html: 'zh-Hant',
    hreflang: 'zh-Hant',
    ogLocale: 'zh_TW',
    locale: 'zh-Hant-TW',
    script: 'zh-Hant',
    offer: '也有繁體中文版',
    ready: false,
  },
] as const satisfies readonly Language[];

export interface Language {
  /** The game's code for it: dictionaries' file names, `?lang=`, the stored choice, the usage statistics. */
  code: string;
  /** Its name in itself («Deutsch», «日本語»), as every language list shows it. */
  name: string;
  /** Its folder on the site ('' for French at the root, 'zh-hans/' in lower case as addresses are). */
  dir: string;
  /** The HTML `lang` attribute: exact, since a Han character is drawn differently in Japanese and in each Chinese. */
  html: string;
  hreflang: string;
  ogLocale: string;
  /** The `Intl` locale: plurals, ordinals, dates, lists. */
  locale: string;
  /** The writing it needs: the site's fonts draw the Latin ones; the others take the system's (styles/lang.css). */
  script: 'latin' | 'ja' | 'zh-Hans' | 'zh-Hant';
  /** «Also in English», written in the language: the band a home page shows a visitor whose device speaks it. */
  offer: string;
  /** Complete and reviewed: offered to players, detected, given its pages. */
  ready: boolean;
}

export type Lang = (typeof LANGUAGES)[number]['code'];
/** A language players can pick today: the type the site's pages and their texts are keyed by. */
export type ReadyLang = Extract<(typeof LANGUAGES)[number], { ready: true }>['code'];

export const LANG_CODES = LANGUAGES.map((l) => l.code) as [Lang, ...Lang[]];
export const READY_LANGS = LANGUAGES.filter((l) => l.ready).map((l) => l.code) as ReadyLang[];
/** French: the source of every text, the language when nothing else is known. */
export const SOURCE_LANG = 'fr' satisfies ReadyLang;

export const isLang = (x: unknown): x is Lang => typeof x === 'string' && (LANG_CODES as string[]).includes(x);
export const isReadyLang = (x: unknown): x is ReadyLang =>
  typeof x === 'string' && (READY_LANGS as string[]).includes(x);

export function language(code: Lang): Language {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

/**
 * The language of a browser's tag (`navigator.languages`), if Tamalou has it: Chinese by script, Taiwan, Hong Kong and
 * Macao written in Traditional, the rest in Simplified; Portuguese of any country is Brazil's; else the primary subtag.
 */
export function langOfTag(tag: string): Lang | null {
  const parts = tag.toLowerCase().replaceAll('_', '-').split('-');
  const primary = parts[0] ?? '';
  if (primary === 'zh') {
    if (parts.includes('hant') || parts.some((p) => p === 'tw' || p === 'hk' || p === 'mo')) return 'zh-Hant';
    return 'zh-Hans';
  }
  return isLang(primary) ? primary : null;
}

/** The first of a browser's languages that is offered (`among`, the ready ones by default), or null. */
export function detectLang(tags: readonly string[], among: readonly Lang[] = READY_LANGS): Lang | null {
  for (const tag of tags) {
    const lang = langOfTag(tag);
    if (lang && among.includes(lang)) return lang;
  }
  return null;
}

/** A language's legal notice from the site's root: French's kept its old address, the others are `<dir>legal/`. */
export const legalDir = (code: Lang): string => (code === 'fr' ? 'mentions-legales/' : `${language(code).dir}legal/`);
