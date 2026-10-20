/**
 * Every fact about the site that its pages repeat (ADR-0017): where it lives, its pages and their languages. Read by
 * the build (build/pages.ts) and by the tests; no secret here, everything ends up in the pages.
 */

/** The canonical address; a build for another host sets VITE_SITE_URL. GitHub Pages serves a copy under /tamalou/. */
export const SITE_URL = 'https://tamalou.steevepommier.com/';

export const SOURCE_URL = 'https://github.com/CostardRouge/tamalou';
export const LICENSE_URL = `${SOURCE_URL}/blob/main/LICENSE`;
export const AUTHOR = { name: 'Steeve Pommier', url: 'https://steevepommier.com/' };

/** Where to write about the site, the legal notice, a takedown. */
export const CONTACT = 'pommier.steeve+tamalou@gmail.com';

/** Audience measurement (ADR-0018): the author's self-hosted Umami, the one Versus and steevepommier.com report to. */
export const ANALYTICS = {
  /** The tracker, named /insight on the instance (TRACKER_SCRIPT_NAME): /script.js is on the filter lists. */
  src: 'https://insight.steevepommier.com/insight',
  /** Tamalou's key in the Umami dashboard; VITE_UMAMI_WEBSITE_ID overrides it, empty turns measurement off. */
  websiteId: '73c51517-64a5-4a99-aa90-86a51dfa2dd5',
  /** Hosts allowed to report besides the canonical one: the GitHub Pages copy. A LAN server never reports. */
  domains: ['tamalou.steevepommier.com', 'costardrouge.github.io'],
};

/**
 * The light theme's tokens (src/styles/tokens.css) for what is drawn outside CSS: the theme-color tags and the social
 * cards (scripts/card.mjs). test/icons.test.ts holds them to the stylesheet.
 */
export const COLORS = {
  bg: '#eceef2',
  bgDark: '#0e1015',
  ink: '#13151b',
  muted: '#5a6072',
  a: '#2743f5',
  b: '#e4492a',
  cardFace: '#fffdf8',
  cardEdge: '#c9ced8',
  cardBackInk: '#dfe5ff',
} as const;

export type Lang = 'fr' | 'en';
/** `moved`: an old address that sends its visitor on (the game was at jouer/ before play/). */
export type PageKind = 'home' | 'play' | 'legal' | 'moved';

export interface Page {
  /** The HTML file, relative to apps/web (Vite's root). */
  file: string;
  /** Its address on the site, relative to the root: '' for the home page, 'play/' for the game. */
  path: string;
  lang: Lang;
  kind: PageKind;
  /** The same page in the other language, when there is one (hreflang). */
  twin?: string;
}

export const PAGES: Page[] = [
  { file: 'index.html', path: '', lang: 'fr', kind: 'home', twin: 'en/' },
  { file: 'en/index.html', path: 'en/', lang: 'en', kind: 'home', twin: '' },
  { file: 'play/index.html', path: 'play/', lang: 'fr', kind: 'play' },
  { file: 'mentions-legales/index.html', path: 'mentions-legales/', lang: 'fr', kind: 'legal', twin: 'en/legal/' },
  { file: 'en/legal/index.html', path: 'en/legal/', lang: 'en', kind: 'legal', twin: 'mentions-legales/' },
  { file: 'jouer/index.html', path: 'jouer/', lang: 'fr', kind: 'moved' },
];

/** The game's address from the root. */
export const PLAY_PATH = 'play/';

export interface SocialCard {
  /** The PNG in public/, drawn by scripts/card.mjs and committed. */
  path: string;
  width: number;
  height: number;
  /** What the card shows, for og:image:alt. */
  alt: string;
}

/**
 * The link preview of each language (COMMON-PROJECT-SPEC C17): a 1200×630 card, not the icon, named by the og:image
 * tags of every page of that language. A redrawn card takes a new file name: unfurlers cache a card by its URL.
 */
export const OG_IMAGES: Record<Lang, SocialCard> = {
  fr: {
    path: 'og.png',
    width: 1200,
    height: 630,
    alt: 'Tamalou : quatre cartes, de la mémoire et du bluff. Le jeu de cartes, seul contre des bots, à plusieurs sur un téléphone ou en ligne.',
  },
  en: {
    path: 'og-en.png',
    width: 1200,
    height: 630,
    alt: 'Tamalou: four cards, memory and bluff. The card game, solo against bots, around one phone or online.',
  },
};

/** What the card says, in the home page's own words (src/landing/text.ts): three short lines, a sentence, the button and its note. */
export const CARD_COPY: Record<Lang, { lines: [string, string, string]; body: string; cta: string; note: string }> = {
  fr: {
    lines: ['Quatre cartes,', 'de la mémoire', 'et du bluff.'],
    body: 'Le plus petit total gagne. Seul contre des bots, à plusieurs sur un téléphone, en Wi-Fi ou en ligne.',
    cta: 'Jouer',
    note: 'Gratuit, sans compte',
  },
  en: {
    lines: ['Four cards,', 'memory', 'and bluff.'],
    body: 'The lowest total wins. Solo against bots, around one phone, on your Wi-Fi or online.',
    cta: 'Play',
    note: 'Free, no account',
  },
};

/**
 * The colours the pages' `theme-color`, the manifest and the icons share: the values of src/styles/tokens.css
 * (Versus's, ADR-0007) copied here because a manifest is plain JSON read once at install.
 */
export const THEME = {
  /** Page background, light and dark (`--bg`). */
  bg: { light: COLORS.bg, dark: COLORS.bgDark },
  /** Cobalt (`--a`): the card back, the icon's ground. */
  accent: COLORS.a,
} as const;

/** What the installed app is called and says of itself (the manifest; one language: French is the default). */
export const APP = {
  name: 'Tamalou',
  description: 'Le jeu de cartes Tamalou : quatre cartes, de la mémoire et du bluff.',
  lang: 'fr',
} as const;

/**
 * Shortcuts on the installed app's icon (a long press on Android, a right click on desktop). Each opens the game
 * with `?shortcut=<key>`, which the app reads once and drops from the address (src/pwa.ts). Their icons are drawn
 * by scripts/icons.mjs from `public/<icon>.svg`; like the other icons, a new drawing gets new file names.
 */
export const SHORTCUTS = [
  {
    key: 'solo',
    name: 'Partie solo',
    short: 'Solo',
    description: 'Une partie contre les bots, avec tes derniers réglages',
    icon: 'shortcut-solo',
  },
  {
    key: 'pass',
    name: 'À plusieurs, un téléphone',
    short: 'À plusieurs',
    description: 'Le téléphone passe de main en main autour de la table',
    icon: 'shortcut-pass',
  },
] as const;
export type ShortcutKey = (typeof SHORTCUTS)[number]['key'];
export const SHORTCUT_SIZES = [96, 192] as const;

/**
 * Screenshots in the manifest, for the richer install dialog (Chrome on Android shows the narrow ones, desktop the
 * wide ones). Taken from the real game by scripts/screenshots.ts, files committed in public/, never precached; like
 * the icons, new pictures get new file names. Each form factor keeps one size: the browser wants them alike,
 * between 320 and 3840 px, the long side at most 2.3 times the short one.
 */
export const SCREEN_SIZES = {
  narrow: { width: 390, height: 844, scale: 2 },
  wide: { width: 1280, height: 800, scale: 1 },
} as const;
export type ScreenForm = keyof typeof SCREEN_SIZES;
export interface Screenshot {
  file: string;
  form: ScreenForm;
  /** What the script puts on screen (scripts/screenshots.ts). */
  view: 'home' | 'table' | 'rules';
  label: string;
}
export const SCREENSHOTS: Screenshot[] = [
  {
    file: 'screen-table-narrow.png',
    form: 'narrow',
    view: 'table',
    label: 'La table : tes quatre cartes, la pioche et la défausse',
  },
  {
    file: 'screen-home-narrow.png',
    form: 'narrow',
    view: 'home',
    label: 'Seul contre des bots, à plusieurs sur un téléphone ou en ligne',
  },
  { file: 'screen-rules-narrow.png', form: 'narrow', view: 'rules', label: 'Les règles de la table, à feuilleter' },
  {
    file: 'screen-table-wide.png',
    form: 'wide',
    view: 'table',
    label: 'La table : tes quatre cartes, la pioche et la défausse',
  },
  {
    file: 'screen-home-wide.png',
    form: 'wide',
    view: 'home',
    label: 'Seul contre des bots, à plusieurs sur un téléphone ou en ligne',
  },
];

/** The page a file is, from its path relative to apps/web (any separator). */
export function pageOf(file: string): Page | undefined {
  const f = file.replaceAll('\\', '/').replace(/^\/+/, '');
  return PAGES.find((p) => p.file === f);
}

/** From a page to the site's root: '' at the root, '../' one folder down. */
export const toRoot = (page: Page): string => '../'.repeat(page.path.split('/').filter(Boolean).length);

/** The canonical address of the build (VITE_SITE_URL, else SITE_URL), always ending in '/'. */
export function siteUrl(env: Record<string, string | undefined>): string {
  const raw = env.VITE_SITE_URL?.trim() || SITE_URL;
  try {
    const url = new URL(raw);
    if (url.protocol === 'https:' || url.protocol === 'http:')
      return url.href.endsWith('/') ? url.href : `${url.href}/`;
  } catch {
    /* an unusable address keeps the default */
  }
  return SITE_URL;
}
