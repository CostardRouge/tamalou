import { footer, type HomeLinks, header } from '../landing/markup.ts';
import { LEGAL } from './text.ts';

/**
 * The legal notice's markup, written at build time into mentions-legales/ and en/legal/ (build/pages.ts, ADR-0017),
 * with the home page's header and footer. The measurement switch (#count) is hidden until the script (main.ts) knows
 * what this browser does; each line in it shows for one state (`data-when`).
 */

type Lang = 'fr' | 'en';

export function legalBody(lang: Lang, links: HomeLinks & { home: string; email: string; license: string }): string {
  const t = LEGAL[lang];
  const fill = (s: string) =>
    s
      .replaceAll('{email}', `<a href="mailto:${links.email}">${links.email}</a>`)
      .replaceAll('{source}', links.source)
      .replaceAll('{license}', links.license);
  const p = (s: string) => `<p>${fill(s)}</p>`;
  const sections: Array<[string, string, string]> = [
    ['editeur', t.pubTitle, p(t.pub1) + p(t.pubContact) + p(t.pub2)],
    ['hebergement', t.hostTitle, p(t.host1) + p(t.host2) + p(t.host3)],
    [
      'confidentialite',
      t.privTitle,
      `${p(`<b>${t.privShort}</b>`)}
<h3>${t.deviceTitle}</h3>${p(t.device1)}${p(t.device2)}
<h3>${t.roomsTitle}</h3>${p(t.rooms1)}
<h3 id="mesure">${t.countTitle}</h3>${p(t.count1)}${p(t.count2)}${p(t.count3)}${p(t.count4)}
<div class="count" id="count" hidden>
<p data-when="on">${t.countOn}</p>
<p data-when="off">${t.countOff}</p>
<p data-when="signal">${t.countSignal}</p>
<p data-when="none">${t.countNone}</p>
<button type="button" class="btn btn-ghost btn-sm" id="count-toggle" data-when="on off"><span data-when="on">${t.countStop}</span><span data-when="off">${t.countResume}</span></button>
</div>
<h3>${t.cookiesTitle}</h3>${p(t.cookies1)}
<h3>${t.logsTitle}</h3>${p(t.logs1)}`,
    ],
    ['droits', t.rightsTitle, p(t.rights1)],
    ['licence', t.licenceTitle, p(t.licence1)],
    ['responsabilite', t.liabTitle, p(t.liab1)],
  ];
  return `${header(lang, links, false)}
<main class="legal wrap">
<h1 class="h2">${t.title}</h1>
<p class="sub">${t.intro}</p>
<nav class="toc" aria-label="${t.tocAria}"><ul>${sections.map(([id, title]) => `<li><a href="#${id}">${title}</a></li>`).join('')}</ul></nav>
${sections.map(([id, title, body]) => `<section id="${id}">\n<h2>${title}</h2>\n${body}\n</section>`).join('\n')}
<p class="updated">${t.updated}</p>
</main>
${footer(lang, links)}`;
}
