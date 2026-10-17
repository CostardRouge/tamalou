import { relative } from 'node:path';
import type { Plugin } from 'vite';
import { homeBody } from '../src/landing/markup.ts';
import { LANDING } from '../src/landing/text.ts';
import { legalBody } from '../src/legal/markup.ts';
import { LEGAL } from '../src/legal/text.ts';
import { type AnalyticsConfig, analyticsConfig, analyticsTag } from './analytics.ts';
import {
  AUTHOR,
  CONTACT,
  LICENSE_URL,
  PAGES,
  type Page,
  PLAY_PATH,
  pageOf,
  SOURCE_URL,
  siteUrl,
  toRoot,
} from './site.ts';

/**
 * Fills each page's shell (ADR-0017): the head (title, description, canonical address, languages, icons, manifest,
 * audience measurement's settings, ADR-0018) and, for the static pages, the body, written from build/site.ts and the dictionaries. Runs after Vite's own work on
 * the HTML, so what it writes is left exactly as written: relative links that work at a domain's root and under
 * GitHub Pages' /tamalou/ alike.
 */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** The address of a page from another one: relative, and never empty (an empty href is the page itself). */
export const link = (from: Page, path: string) => `${toRoot(from)}${path}` || './';

const PLAY_HEAD = {
  title: 'Tamalou',
  description:
    'Le jeu de cartes Tamalou : quatre cartes, de la mémoire et du bluff. Seul contre des bots, à plusieurs sur un téléphone, en ligne ou sur le réseau local.',
};

/**
 * Sends an old link to the game: a shared room or rules link from before the game moved to /jouer/ (`#room=…`,
 * `#rules=…`), and the app installed on a phone back then, whose start address is still the root.
 */
const redirect = (play: string) =>
  `<script>(function(){var h=location.hash;if(/^#(room|rules)=/.test(h)||(window.matchMedia&&matchMedia('(display-mode: standalone)').matches))location.replace(${JSON.stringify(play)}+h)})()</script>`;

const headText = (page: Page) => {
  if (page.kind === 'home') return LANDING[page.lang];
  if (page.kind === 'legal') return { ...LEGAL[page.lang], title: `${LEGAL[page.lang].title} — Tamalou` };
  return PLAY_HEAD;
};

export function pageHead(page: Page, site: string, analytics: AnalyticsConfig | null = null): string {
  const root = toRoot(page);
  const t = headText(page);
  const lines = [`<title>${t.title}</title>`, `<meta name="description" content="${esc(t.description)}" />`];
  if (page.kind === 'play') {
    // The home pages carry the words; the game screen is not a page to find.
    lines.push('<meta name="robots" content="noindex" />');
  } else {
    lines.push(`<link rel="canonical" href="${site}${page.path}" />`);
    if (page.twin !== undefined) {
      const fr = page.lang === 'fr' ? page.path : page.twin;
      const en = page.lang === 'en' ? page.path : page.twin;
      lines.push(
        `<link rel="alternate" hreflang="fr" href="${site}${fr}" />`,
        `<link rel="alternate" hreflang="en" href="${site}${en}" />`,
        `<link rel="alternate" hreflang="x-default" href="${site}${fr}" />`,
      );
    }
    lines.push(
      '<meta property="og:type" content="website" />',
      '<meta property="og:site_name" content="Tamalou" />',
      `<meta property="og:title" content="${esc(t.title)}" />`,
      `<meta property="og:description" content="${esc(t.description)}" />`,
      `<meta property="og:url" content="${site}${page.path}" />`,
      `<meta property="og:locale" content="${page.lang === 'fr' ? 'fr_FR' : 'en_US'}" />`,
      `<meta property="og:image" content="${site}icon-512.png" />`,
    );
  }
  lines.push(
    '<meta name="theme-color" content="#eceef2" media="(prefers-color-scheme: light)" />',
    '<meta name="theme-color" content="#0e1015" media="(prefers-color-scheme: dark)" />',
    '<meta name="apple-mobile-web-app-title" content="Tamalou" />',
    `<link rel="icon" href="${root}icon.svg" type="image/svg+xml" />`,
    `<link rel="icon" href="${root}favicon-32.png" sizes="32x32" type="image/png" />`,
    `<link rel="icon" href="${root}favicon-16.png" sizes="16x16" type="image/png" />`,
    `<link rel="apple-touch-icon" href="${root}apple-touch-icon.png" />`,
    `<link rel="manifest" href="${root}manifest.webmanifest" />`,
  );
  if (page.kind === 'home') lines.push(redirect(link(page, PLAY_PATH)));
  if (analytics) lines.push(analyticsTag(analytics, page.path));
  return lines.join('\n    ');
}

export function pageBody(page: Page): string {
  if (page.kind === 'play') return '';
  const home = PAGES.find((p) => p.kind === 'home' && p.lang === page.lang);
  const legal = PAGES.find((p) => p.kind === 'legal' && p.lang === page.lang);
  const links = {
    home: link(page, home?.path ?? ''),
    play: link(page, PLAY_PATH),
    other: link(page, page.twin ?? ''),
    source: SOURCE_URL,
    author: AUTHOR,
    footer: [`<a href="${link(page, legal?.path ?? '')}">${LANDING[page.lang].footLegal}</a>`],
  };
  if (page.kind === 'legal') return legalBody(page.lang, { ...links, email: CONTACT, license: LICENSE_URL });
  return homeBody(page.lang, links);
}

export function pages(): Plugin {
  let root = '';
  let site = '';
  let analytics: AnalyticsConfig | null = null;
  return {
    name: 'tamalou-pages',
    configResolved(config) {
      root = config.root;
      site = siteUrl(config.env);
      analytics = analyticsConfig(config.env, { production: config.isProduction, url: site });
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const page = pageOf(relative(root, ctx.filename));
        if (!page) throw new Error(`No page in build/site.ts for ${ctx.filename}`);
        return html
          .replace('<!-- page:head -->', pageHead(page, site, analytics))
          .replace('<!-- page:body -->', pageBody(page));
      },
    },
  };
}

/** Vite's inputs: every page of build/site.ts. */
export const inputs = (root: string) =>
  Object.fromEntries(PAGES.map((p) => [p.path.replace(/\/$/, '').replaceAll('/', '-') || 'home', `${root}/${p.file}`]));
