import { LANDING } from './text.ts';

/**
 * The home page's markup, written at build time into index.html and en/index.html (build/pages.ts, ADR-0016): every
 * word is in the static HTML for search engines and for a visitor without JavaScript. The script (main.tsx) then
 * brings in what moves, into the boxes left here: the first round (#tutorial, whose static text is its first step) and
 * the hand quiz (#quiz), their cards drawn by the card theme like everywhere else (ADR-0007). Pure strings, no DOM,
 * no React: the Vite config imports it.
 */

type Lang = 'fr' | 'en';

const ICONS: Record<string, string> = {
  bot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4M9 14h.01M15 14h.01"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M3 9l-1 3 1 3M21 9l1 3-1 3"/>',
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M8.5 15a5 5 0 0 1 7 0M10.5 17.5a2 2 0 0 1 3 0"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
};

const icon = (name: string) =>
  `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ''}</svg>`;

export interface HomeLinks {
  /** The game. */
  play: string;
  /** The same page in the other language. */
  other: string;
  source: string;
  author: { name: string; url: string };
  /** Extra links for the footer (the legal notice), already as <a> tags. */
  footer?: string[];
}

/** The brand and the navigation, shared by the home page and the other static pages. */
export function header(lang: Lang, links: { home: string; play: string; other: string }, sections = true): string {
  const t = LANDING[lang];
  return `<header class="nav wrap">
<a class="brand" href="${links.home}"><span class="brand-mark" aria-hidden="true">T</span>Tamalou</a>
<nav class="nav-links" aria-label="${t.navAria}">
${
  sections
    ? [
        ['manche', t.navRound],
        ['valeurs', t.navValues],
        ['modes', t.navModes],
      ]
        .map(([id, label]) => `<a class="hide-s" href="#${id}">${label}</a>\n`)
        .join('')
    : ''
}<a href="${links.other}" hreflang="${lang === 'fr' ? 'en' : 'fr'}" lang="${lang === 'fr' ? 'en' : 'fr'}" data-lang="${lang === 'fr' ? 'en' : 'fr'}" aria-label="${t.otherLang}">${t.otherLangShort}</a>
<a class="btn btn-a btn-sm" href="${links.play}">${t.navPlay}</a>
</nav>
</header>`;
}

export function footer(lang: Lang, links: HomeLinks): string {
  const t = LANDING[lang];
  const by = t.footBy.replace('{url}', links.author.url).replace('{name}', links.author.name);
  const items = [...(links.footer ?? []), `<a href="${links.source}">${t.footSource}</a>`];
  return `<footer class="foot wrap">
<span>${by}</span>
<nav aria-label="${t.footAria}">${items.join('')}</nav>
</footer>`;
}

export function homeBody(lang: Lang, links: HomeLinks & { home: string }): string {
  const t = LANDING[lang];
  const tile = (m: { icon: string; t: string; p: string }) =>
    `<div class="tile"><span class="ico">${icon(m.icon)}</span><h3>${m.t}</h3><p>${m.p}</p></div>`;
  return `${header(lang, links)}
<main>
<section class="head wrap">
<p class="eyebrow">${t.eyebrow}</p>
<h1 class="h1">${t.heroTitle}</h1>
<p class="lead">${t.heroLead}</p>
</section>

<section class="game wrap" id="manche" aria-label="${t.roundAria}" data-play="${links.play}">
<div class="coach">
<span class="coach-tag">${t.tagTurn.replace('{n}', '1')}</span>
<h2>${t.peekTitle}</h2>
<p>${t.peekText}</p>
</div>
</section>

<section class="sec wrap" id="valeurs">
<div class="quiz">
<div>
<p class="kicker">${t.quizKicker}</p>
<h2 class="h2">${t.quizTitle}</h2>
<p class="sub">${t.quizSub}</p>
</div>
<div class="quiz-box" id="quiz"></div>
</div>
</section>

<section class="sec wrap" id="modes">
<h2 class="h2">${t.modesTitle}</h2>
<p class="sub">${t.modesSub}</p>
<div class="grid4">${t.modes.map(tile).join('')}</div>
</section>

<section class="wrap">
<div class="band">
<div>
<h2 class="h2">${t.bandTitle}</h2>
<p>${t.bandText}</p>
</div>
<a class="btn btn-light" href="${links.play}">${t.bandPlay}</a>
</div>
</section>
</main>
${footer(lang, links)}`;
}
