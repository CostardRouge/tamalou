import { execFileSync } from 'node:child_process';
import type { Plugin } from 'vite';
import { LANDING } from '../src/landing/text.ts';
import { notFoundHtml } from './notfound.ts';
import { headersFile } from './security.ts';
import { AUTHOR, PAGES, type Page, PLAY_PATH, SOURCE_URL, siteUrl } from './site.ts';

/**
 * Findability (COMMON-PROJECT-SPEC C17): robots.txt, the sitemap and llms.txt, written at the site's root at build time
 * from build/site.ts and the dictionaries, and answered by the dev server. Pure functions of the site's address, so the
 * tests (test/seo.test.ts) call the same code. Crawlers read robots.txt at the root of a host only: the copy under
 * GitHub Pages' /tamalou/ is never read and the canonical domain's counts; the sitemap's addresses are absolute, on
 * that domain, as every page's canonical tag is. The response headers' file (C16, build/security.ts) and the 404 page
 * (build/notfound.ts) are written the same way.
 */

/** The files written beside index.html. */
export const GENERATED = ['robots.txt', 'sitemap.xml', 'llms.txt', '_headers', '404.html'] as const;

/** The pages a crawler may list: the ones with a canonical address (the game and the old address say noindex). */
export const indexedPages = (): Page[] => PAGES.filter((p) => p.kind === 'home' || p.kind === 'legal');

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const pageUrl = (site: string, kind: Page['kind'], lang: Page['lang']) =>
  `${site}${PAGES.find((p) => p.kind === kind && p.lang === lang)?.path ?? ''}`;

/**
 * Every crawler is welcome, search engines and AI crawlers alike (training and answer engines, the owner's policy as
 * on steevepommier.com and Versus): the home pages carry the words and llms.txt exists to be read. Only the rooms API is
 * off limits; the game screen says noindex in its own head.
 */
export function robotsTxt(site: string): string {
  return ['User-agent: *', 'Allow: /', 'Disallow: /api/', '', `Sitemap: ${site}sitemap.xml`, ''].join('\n');
}

/**
 * The home page and the legal notice of each language, in the plain sitemap format: their hreflang pairs are in each
 * page's head, which Google reads as well as a sitemap's. The game is left out: it is noindex (a sitemap that submits
 * a noindex address is an error in Search Console), reached from the home pages and llms.txt.
 */
export function sitemapXml(site: string, lastmod: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...indexedPages().map((p) => `  <url><loc>${esc(site + p.path)}</loc><lastmod>${esc(lastmod)}</lastmod></url>`),
    '</urlset>',
    '',
  ].join('\n');
}

/** llms.txt (https://llmstxt.org): the game in plain Markdown for language models and answer engines. */
export function llmsTxt(site: string): string {
  return [
    '# Tamalou',
    '',
    `> ${LANDING.en.description}`,
    '',
    'Tamalou is the French card game played at home, a cousin of Cabo and Golf, as a free web game in French first and in English, with no account. Each player keeps four cards face down in a 2×2 grid and looks at two of them at the start; on a turn you draw a card or take the top of the discard, keep it in place of one of yours or throw it, some cards have a power when thrown, a card of the rank just discarded can be thrown out of turn (the quick discard), and you call "Tamalou!" when you believe your total is the lowest. The hands are revealed, the lowest total wins the round, and a game runs until a player reaches 100 points.',
    '',
    '## Modes',
    '',
    '- Solo against one to five bots, at three levels.',
    '- Pass-and-play: several people around one phone, handed over between turns.',
    '- Local network: a server on one machine, no internet needed, everyone on their own phone.',
    '- Online: a temporary room joined by code, link or QR code, gone after two hours idle.',
    '',
    '## Rules',
    '',
    '- The game master sets every rule before the game (card values, powers, penalties, the quick discard, the end) from the presets Classique, Rapide and Débutant; the rules can be read at the table and travel as a link or a JSON file.',
    '- The game installs on a phone; solo and pass-and-play work offline.',
    '',
    '## Links',
    '',
    `- [Tamalou](${pageUrl(site, 'home', 'fr')}): home page, in French, with a guided first round and a quiz`,
    `- [Tamalou in English](${pageUrl(site, 'home', 'en')}): the same page in English`,
    `- [Play](${site}${PLAY_PATH}): the game, in French or English`,
    `- [Source code](${SOURCE_URL}): TypeScript, MIT license`,
    `- [Mentions légales](${pageUrl(site, 'legal', 'fr')}) · [Legal notice and privacy](${pageUrl(site, 'legal', 'en')}): publisher, hosting, what is stored and counted`,
    `- [${AUTHOR.name}](${AUTHOR.url}): author`,
    '',
  ].join('\n');
}

const today = () => new Date().toISOString().slice(0, 10);

/** The last commit's date (the content's real last change), or today outside a git checkout (the Docker build). */
export function lastmod(): string {
  try {
    return (
      execFileSync('git', ['log', '-1', '--format=%cs'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim() || today()
    );
  } catch {
    return today();
  }
}

export interface GeneratedFile {
  body: string;
  type: string;
}

/** The generated files, by name, with the content type the dev server answers. */
export function generatedFiles(site: string, lastmod: string): Record<string, GeneratedFile> {
  return {
    'robots.txt': { body: robotsTxt(site), type: 'text/plain; charset=utf-8' },
    'sitemap.xml': { body: sitemapXml(site, lastmod), type: 'application/xml; charset=utf-8' },
    'llms.txt': { body: llmsTxt(site), type: 'text/markdown; charset=utf-8' },
    _headers: { body: headersFile(), type: 'text/plain; charset=utf-8' },
    // What every host answers an unknown address with (build/notfound.ts).
    '404.html': { body: notFoundHtml(), type: 'text/html; charset=utf-8' },
  };
}

/** Writes the generated files at the root of the build and answers them on the dev server. */
export function seo(): Plugin {
  let site = '';
  return {
    name: 'tamalou-seo',
    configResolved(config) {
      site = siteUrl(config.env);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = req.url?.split('?')[0]?.replace(/^\//, '') ?? '';
        const file = (GENERATED as readonly string[]).includes(name)
          ? generatedFiles(site, lastmod())[name]
          : undefined;
        if (!file) return next();
        res.setHeader('Content-Type', file.type);
        res.end(file.body);
      });
    },
    generateBundle() {
      for (const [fileName, file] of Object.entries(generatedFiles(site, lastmod())))
        this.emitFile({ type: 'asset', fileName, source: file.body });
    },
  };
}
