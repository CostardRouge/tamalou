import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LANDING, type LandingText } from '../src/landing/text.ts';
import { PAGES, PLAY_PATH, THEME } from './site.ts';

/**
 * The 404 page (`404.html` at the root of the build). Every host answers an unknown address with it and a 404 status:
 * the Worker's asset server (`not_found_handling: "404-page"`), GitHub Pages, and the LAN server. It is served at any
 * depth (`/projects/`, `/a/b/c`), where the other pages' relative links would point nowhere, so it carries everything
 * itself: the design tokens and the icon written into the page, no stylesheet, no font, no script bundle. Its links
 * are written from the root (`/play/`); on GitHub Pages, where the site lives under `/tamalou/`, the one inline script
 * puts that folder in front of them. French first, then English, both from the home page's dictionary. Not indexed.
 */

const web = resolve(import.meta.dirname, '..');
const read = (file: string) => readFileSync(resolve(web, file), 'utf8');

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** The links' targets, from the site's root. */
const home = (lang: 'fr' | 'en') => PAGES.find((p) => p.kind === 'home' && p.lang === lang)?.path ?? '';

/**
 * Puts the site's folder in front of every link on GitHub Pages (`/tamalou/` on costardrouge.github.io); elsewhere the
 * site is at the host's root and the links stay as written. The body exactly as written between its tags: the content
 * security policy names it by hash (build/security.ts, through `inlineScripts()` in build/pages.ts).
 */
export const NOT_FOUND_SCRIPT =
  "(function(){if(!/\\.github\\.io$/.test(location.hostname))return;var s=location.pathname.split('/')[1];if(!s)return;var a=document.querySelectorAll('a[data-to]');for(var i=0;i<a.length;i++)a[i].href='/'+s+'/'+a[i].getAttribute('data-to')})()";

const to = (path: string) => `data-to="${esc(path)}" href="/${esc(path)}"`;

const STYLE = `
      *, *::before, *::after { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; min-height: 100dvh; display: grid; place-items: center;
        padding: 32px 16px; background: var(--bg); color: var(--ink);
        font: 17px/1.55 var(--f-body); -webkit-text-size-adjust: 100%; }
      main { width: 100%; max-width: 34rem; }
      .mark { display: block; width: 76px; height: 76px; border-radius: 18px; box-shadow: var(--shadow);
        transform: rotate(-5deg); }
      .eyebrow { margin: 30px 0 8px; font: 600 13px/1 var(--f-mono); letter-spacing: 0.08em;
        text-transform: uppercase; color: var(--b-ink); }
      h1 { margin: 0 0 12px; font: 800 clamp(1.9rem, 7vw, 2.6rem)/1.08 var(--f-display); letter-spacing: -0.02em;
        text-wrap: balance; }
      .lead { margin: 0 0 26px; color: var(--muted); }
      .actions { display: flex; flex-wrap: wrap; gap: 10px; margin: 0 0 40px; }
      .btn { display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 0 24px;
        border-radius: var(--r-pill); font: 700 17px/1 var(--f-display); text-decoration: none; color: var(--ink);
        box-shadow: inset 0 0 0 1.5px var(--field); }
      .btn:hover { box-shadow: inset 0 0 0 1.5px var(--ink); }
      .btn-a, .btn-a:hover { background: var(--a); color: var(--on-accent); box-shadow: none; }
      .btn-a:hover { filter: brightness(1.08); }
      a:focus-visible { outline: 3px solid var(--a); outline-offset: 3px; }
      .other { padding-top: 18px; border-top: 1px solid var(--line); font-size: 15px; color: var(--muted); }
      .other p { margin: 0 0 6px; }
      .other strong { color: var(--ink); }
      .other a { color: var(--ink); font-weight: 600; }
      @media (prefers-reduced-motion: no-preference) {
        .mark { animation: deal 0.6s cubic-bezier(0.2, 0.8, 0.2, 1.2) both; }
        @keyframes deal { from { opacity: 0; transform: translateY(-14px) rotate(-18deg); } }
      }`;

/** The icon, drawn inline: the page cannot know where icon.svg sits from its own address. */
function icon(): string {
  return read('public/icon.svg')
    .replace(/<title>[\s\S]*?<\/title>\s*/, '')
    .replace(/<!--[\s\S]*?-->\s*/g, '')
    .replace('<svg ', '<svg class="mark" aria-hidden="true" focusable="false" ')
    .trim();
}

function favicon(): string {
  const svg = read('public/icon.svg').replace(/\s*\n\s*/g, ' ');
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const lead = (t: LandingText) => `<p class="eyebrow">${esc(t.notFoundEyebrow)}</p>
      <h1>${esc(t.notFoundHeading)}</h1>
      <p class="lead">${esc(t.notFoundText)}</p>`;

export function notFoundHtml(): string {
  const fr = LANDING.fr;
  const en = LANDING.en;
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="robots" content="noindex" />
    <title>${esc(fr.notFoundTitle)}</title>
    <meta name="theme-color" content="${THEME.bg.light}" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="${THEME.bg.dark}" media="(prefers-color-scheme: dark)" />
    <link rel="icon" href="${favicon()}" type="image/svg+xml" />
    <style>
${read('src/styles/tokens.css').trim()}
${STYLE}
    </style>
  </head>
  <body>
    <main>
      ${icon()}
      ${lead(fr)}
      <p class="actions">
        <a class="btn btn-a" ${to(PLAY_PATH)}>${esc(fr.notFoundPlay)}</a>
        <a class="btn" ${to(home('fr'))}>${esc(fr.notFoundHome)}</a>
      </p>
      <section class="other" lang="en">
        <p><strong>${esc(en.notFoundHeading)}</strong> ${esc(en.notFoundText)}</p>
        <p><a ${to(PLAY_PATH)}>${esc(en.notFoundPlay)}</a> · <a ${to(home('en'))}>${esc(en.notFoundHome)}</a></p>
      </section>
    </main>
    <script>${NOT_FOUND_SCRIPT}</script>
  </body>
</html>
`;
}
