import type { Tally, UsageSummary } from '@tamalou/shared';

// The admin page (ADR-0024): the anonymous usage statistics of a period, drawn as plain HTML by the Worker. It is the
// owner's alone, signed in through Sésame, so it speaks French only. No script: the period is a link, signing out a
// form; the styles are one inline sheet, which the page's own Content-Security-Policy allows (apps/worker).

const esc = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

/** What each value is called on the page; a value with no name here is shown as it is. */
const NAMES: Record<string, string> = {
  solo: 'Seul contre des bots',
  pass: 'Un téléphone à plusieurs',
  online: 'En ligne',
  bots: 'Contre des bots',
  humans: 'Entre humains',
  mixed: 'Humains et bots',
  easy: 'Facile',
  medium: 'Moyen',
  hard: 'Fort',
  qr: 'QR code',
  link: 'Lien partagé',
  code: 'Code tapé',
  created: 'Salle créée',
  phone: 'Téléphone',
  tablet: 'Tablette',
  desktop: 'Ordinateur',
  portrait: 'Portrait',
  landscape: 'Paysage',
  true: 'Oui',
  false: 'Non',
  unknown: 'Inconnue',
  fr: 'Français',
  en: 'Anglais',
  classic: 'Classique',
};

/** A device setting's values, named as the game's settings name them (apps/web i18n). */
const SETTING_NAMES: Partial<Record<keyof UsageSummary['context'], Record<string, string>>> = {
  hand: { grid: 'Grille', row: 'Ligne', flat: 'Posée', arc: 'Arc', fan: 'Éventail', carousel: 'Carrousel' },
  drawView: { held: 'En main', big: 'En grand' },
  botPace: { fast: 'Vif', normal: 'Normal', slow: 'Posé' },
  cardSpeed: { fast: 'Rapide', normal: 'Normale', soft: 'Douce' },
};

const CONTEXT_TITLES: Record<keyof UsageSummary['context'], string> = {
  device: 'Appareil',
  orientation: 'Orientation',
  connection: 'Connexion',
  installed: 'Jeu installé',
  lang: 'Langue',
  sound: 'Son',
  haptics: 'Vibrations',
  hand: 'Disposition de la main',
  drawView: 'Carte piochée',
  botPace: 'Rythme des bots',
  cardSpeed: 'Vitesse des cartes',
};

export const PERIODS = [7, 30, 90, 365] as const;

const percent = (x: number) => `${Math.round(x * 100)} %`;
const one = (x: number) => (Math.round(x * 10) / 10).toLocaleString('fr-FR');

function tallyCard(title: string, t: Tally, names: Record<string, string> = {}): string {
  const total = t.reduce((a, v) => a + v.count, 0);
  const rows =
    total === 0
      ? '<p class="empty">Rien sur la période.</p>'
      : `<ul class="tally">${t
          .map(
            (v) =>
              `<li><span class="lab">${esc(names[v.value] ?? NAMES[v.value] ?? v.value)}</span><span class="bar"><i style="width:${(
                (v.count / total) * 100
              ).toFixed(1)}%"></i></span><span class="num">${v.count}</span></li>`,
          )
          .join('')}</ul>`;
  return `<section class="card"><h3>${esc(title)}</h3>${rows}</section>`;
}

function dayChart(s: UsageSummary): string {
  const max = Math.max(1, ...s.days.map((d) => d.started));
  const bars = s.days
    .map((d) => {
      const h = ((d.started / max) * 100).toFixed(1);
      const label = `${d.day} : ${d.started} lancées, ${d.ended} terminées, ${d.rooms} salles, ${d.joins} arrivées`;
      return `<li title="${esc(label)}"><i style="height:${h}%"></i><span class="sr">${esc(label)}</span></li>`;
    })
    .join('');
  const first = s.days[0]?.day ?? '';
  const last = s.days.at(-1)?.day ?? '';
  return `<section class="card wide"><h3>Parties lancées par jour</h3><ol class="chart">${bars}</ol><p class="axis"><span>${esc(first)}</span><span>${esc(last)}</span></p></section>`;
}

export interface AdminPageInput {
  summary: UsageSummary;
  days: number;
  who: string;
  version: string;
}

export function adminPage({ summary: s, days, who, version }: AdminPageInput): string {
  const kpi = (n: number | string, label: string) =>
    `<div class="kpi"><b>${esc(String(n))}</b><span>${esc(label)}</span></div>`;
  const periods = PERIODS.map((d) =>
    d === days ? `<b aria-current="page">${d} j</b>` : `<a href="?days=${d}">${d} j</a>`,
  ).join('');
  const context = (Object.keys(CONTEXT_TITLES) as (keyof UsageSummary['context'])[])
    .map((k) => tallyCard(CONTEXT_TITLES[k], s.context[k], SETTING_NAMES[k]))
    .join('');
  return shell(
    'Statistiques',
    `<header class="top">
<div><p class="kicker">Tamalou · administration</p><h1>Statistiques</h1></div>
<form method="post" action="logout"><span class="who">${esc(who)}</span><button type="submit">Se déconnecter</button></form>
</header>
<nav class="periods" aria-label="Période">${periods}</nav>
<div class="kpis">
${kpi(s.totals.started, 'parties lancées')}
${kpi(s.totals.ended, 'parties terminées')}
${kpi(s.totals.rooms, 'salles créées')}
${kpi(s.totals.joins, 'arrivées en salle')}
${kpi(one(s.rounds), 'manches par partie')}
${kpi(one(s.minutes), 'minutes par partie')}
${kpi(s.winRate === null ? '—' : percent(s.winRate), 'parties gagnées en solo')}
${kpi(percent(s.rulesChanged), 'parties aux règles changées')}
</div>
${dayChart(s)}
<h2>Les parties</h2>
<div class="grid">
${tallyCard('Mode', s.modes)}
${tallyCard('Adversaires', s.opponents)}
${tallyCard('Joueurs à la table', s.players)}
${tallyCard('Niveau des bots', s.levels)}
${tallyCard('Règles de départ', s.presets)}
${tallyCard('Arrivée dans une salle', s.joins)}
</div>
<h2>Les appareils</h2>
<p class="note">Compté sur tous les événements de la période : un appareil qui joue souvent pèse davantage.</p>
<div class="grid">${context}</div>
<footer><p>Statistiques anonymes : aucun prénom, aucun code de salle, aucune adresse ; gardées 13 mois. v${esc(version)}</p></footer>`,
  );
}

/** A short page: not signed in, refused, not set up. */
export function messagePage(title: string, text: string, action?: { href: string; label: string }): string {
  return shell(
    title,
    `<section class="card message"><h1>${esc(title)}</h1><p>${esc(text)}</p>${
      action ? `<p><a class="button" href="${esc(action.href)}">${esc(action.label)}</a></p>` : ''
    }</section>`,
  );
}

function shell(title: string, body: string): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)} · Tamalou</title>
<style>${STYLE}</style>
</head>
<body><main>${body}</main></body>
</html>`;
}

// Versus's tokens (ADR-0007), light and dark.
const STYLE = `
:root{--bg:#eceef2;--surface:#fafbfd;--ink:#13151b;--muted:#5a6072;--line:#d2d6df;--a:#2743f5;--b:#e4492a;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--bg:#0e1015;--surface:#161920;--ink:#eceef3;--muted:#9298a8;--line:#2a2f3a;--a:#7089ff;--b:#ff7a58}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1100px;margin:0 auto;padding:20px 16px 40px;display:grid;gap:18px}
h1{margin:0;font-size:1.8rem;line-height:1.1}
h2{margin:12px 0 0;font-size:1.1rem}
h3{margin:0 0 10px;font-size:.95rem}
.top{display:flex;flex-wrap:wrap;align-items:end;justify-content:space-between;gap:12px}
.kicker{margin:0 0 4px;font-size:.75rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.top form{display:flex;align-items:center;gap:10px}
.who{color:var(--muted);font-size:.9rem}
button,.button{min-height:40px;padding:0 16px;border-radius:999px;border:2px solid var(--line);background:var(--surface);color:var(--ink);font:inherit;font-weight:700;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}
.button{background:var(--a);border-color:var(--a);color:#fff}
.periods{display:flex;gap:6px;flex-wrap:wrap}
.periods a,.periods b{padding:6px 14px;border-radius:999px;background:var(--surface);color:var(--ink);text-decoration:none;font-weight:600}
.periods b{background:var(--a);color:#fff}
.kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.kpi{background:var(--surface);border-radius:16px;padding:14px;display:grid;gap:2px}
.kpi b{font-size:1.7rem;line-height:1.1}
.kpi span{color:var(--muted);font-size:.85rem}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px}
.card{background:var(--surface);border-radius:16px;padding:16px}
.card.wide{grid-column:1/-1}
.tally{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.tally li{display:grid;grid-template-columns:minmax(0,9rem) 1fr auto;align-items:center;gap:10px;font-size:.9rem}
.lab{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar{height:10px;border-radius:999px;background:var(--line);overflow:hidden}
.bar i{display:block;height:100%;background:var(--a);border-radius:999px}
.num{font-variant-numeric:tabular-nums;color:var(--muted)}
.chart{list-style:none;margin:0;padding:0;height:160px;display:flex;align-items:flex-end;gap:3px}
.chart li{flex:1;height:100%;display:flex;align-items:flex-end}
.chart i{display:block;width:100%;min-height:2px;background:var(--a);border-radius:4px 4px 0 0}
.axis{display:flex;justify-content:space-between;margin:6px 0 0;color:var(--muted);font-size:.8rem}
.note,.empty{margin:0 0 8px;color:var(--muted);font-size:.85rem}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.message{max-width:420px;margin:15vh auto 0;text-align:center}
footer{color:var(--muted);font-size:.8rem}
`;
