import { LANDING } from './text.ts';

/**
 * The home page's markup, written at build time into index.html and en/index.html (build/pages.ts, ADR-0016): every
 * word is in the static HTML for search engines and for a visitor without JavaScript. The script (main.tsx) then
 * brings in what moves: the live table and the cards, drawn by the card theme like everywhere else (ADR-0007), into
 * the `data-card` slots and the #live box left here. Pure strings, no DOM, no React: the Vite config imports it.
 */

type Lang = 'fr' | 'en';

const CHECK =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>';

const ICONS: Record<string, string> = {
  bot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4M9 14h.01M15 14h.01"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M3 9l-1 3 1 3M21 9l1 3-1 3"/>',
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M8.5 15a5 5 0 0 1 7 0M10.5 17.5a2 2 0 0 1 3 0"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
};

const icon = (name: string) =>
  `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ''}</svg>`;

/** A place for a card the script draws; empty without JavaScript, where the text beside it says everything. */
const slot = (card: string) => `<span class="card-slot" data-card="${card}" aria-hidden="true"></span>`;

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
${sections ? `<a class="hide-s" href="#regles">${t.navRules}</a>\n<a class="hide-s" href="#modes">${t.navModes}</a>\n` : ''}<a href="${links.other}" hreflang="${lang === 'fr' ? 'en' : 'fr'}" lang="${lang === 'fr' ? 'en' : 'fr'}" data-lang="${lang === 'fr' ? 'en' : 'fr'}" aria-label="${t.otherLang}">${t.otherLangShort}</a>
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
  const tile = (head: string, title: string, text: string) =>
    `<div class="tile">${head}<h3>${title}</h3><p>${text}</p></div>`;
  return `${header(lang, links)}
<main>
<section class="hero wrap">
<div class="hero-text">
<p class="eyebrow">${t.eyebrow}</p>
<h1 class="h1">${t.heroTitle}</h1>
<p class="lead">${t.heroLead}</p>
<div class="ctas">
<a class="btn btn-a" href="${links.play}">${t.play}</a>
<a class="btn btn-ghost" href="#regles">${t.rulesLink}</a>
</div>
<ul class="facts">${t.facts.map((f) => `<li>${CHECK}${f}</li>`).join('')}</ul>
</div>
<div class="stage" id="live"></div>
</section>
<div class="wrap" id="live-steps"></div>

<section class="sec wrap" id="regles">
<h2 class="h2">${t.rulesTitle}</h2>
<p class="sub">${t.rulesSub}</p>
<div class="grid4">${t.rules.map((r, i) => tile(`<span class="num">0${i + 1}</span>`, r.t, r.p)).join('')}</div>
</section>

<section class="sec wrap">
<h2 class="h2">${t.valuesTitle}</h2>
<p class="sub">${t.valuesSub}</p>
<ul class="values">
${t.values.map((v) => `<li class="val">${slot(v.card)}<span class="val-name">${v.name}</span><b>${v.value}</b></li>`).join('\n')}
<li class="val star">${slot(t.redKing.card)}<span class="val-name">${t.redKing.name}</span><b>${t.redKing.value}</b><span class="tag">${t.redKing.tag}</span></li>
</ul>
</section>

<section class="sec wrap">
<h2 class="h2">${t.powersTitle}</h2>
<p class="sub">${t.powersSub}</p>
<div class="grid4">${t.powers.map((p) => tile(`<div class="fan">${p.cards.map(slot).join('')}</div>`, p.t, p.p)).join('')}</div>
</section>

<section class="sec wrap" id="modes">
<h2 class="h2">${t.modesTitle}</h2>
<p class="sub">${t.modesSub}</p>
<div class="grid4">${t.modes.map((m) => tile(`<span class="ico">${icon(m.icon)}</span>`, m.t, m.p)).join('')}</div>
</section>

<section class="sec wrap">
<div class="rulebox">
<div>
<h2 class="h2">${t.tableTitle}</h2>
<p class="sub">${t.tableSub}</p>
<div class="presets" role="group" aria-label="${t.presetsAria}">
${t.presets.map((p, i) => `<button class="pchip" type="button" data-preset="${p.id}" aria-pressed="${i === 0}">${p.name}</button>`).join('\n')}
</div>
</div>
${t.presets
  .map(
    (p, i) => `<div class="rulecard" data-preset-card="${p.id}"${i === 0 ? '' : ' hidden'}>
<p>${p.desc}</p>
<ul class="rl">${t.presetRows.map((row, k) => `<li><span>${row}</span><span>${p.cells[k] ?? ''}</span></li>`).join('')}</ul>
</div>`,
  )
  .join('\n')}
</div>
</section>

<section class="final wrap">
<h2 class="h2">${t.finalTitle}</h2>
<p class="sub">${t.finalSub}</p>
<a class="btn btn-a" href="${links.play}">${t.play}</a>
</section>
</main>
${footer(lang, links)}`;
}
