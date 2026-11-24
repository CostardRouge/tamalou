import type { Tally, UsageGame, UsageSummary } from '@tamalou/shared';

// The admin pages (ADR-0024): the anonymous usage statistics of a period, a day and its games, one game; drawn as
// plain HTML by the Worker (the owner's picks on the 2026-11-24 canvas). They are the owner's alone, signed in through
// Sésame, so they speak French only. No script: periods, days and games are links, signing out a form; the styles are
// one inline sheet, which the pages' own Content-Security-Policy allows (apps/worker).

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

const longDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const shortDay = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
/** "lundi 24 novembre", "24 nov." for a YYYY-MM-DD day. */
const dayName = (day: string, short = false) => (short ? shortDay : longDay).format(new Date(`${day}T12:00:00Z`));
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

/** A game in a few words: "Seul contre 3 bots", "En ligne, 4 humains + 1 bot". */
export function gameTitle(g: UsageGame): string {
  const bots = g.bots > 0 ? plural(g.bots, 'bot', 'bots') : '';
  if (g.mode === 'solo') return `Seul contre ${bots || 'personne'}`;
  const people = g.mode === 'pass' ? plural(g.humans, 'joueur', 'joueurs') : plural(g.humans, 'humain', 'humains');
  return `${g.mode === 'pass' ? 'Un téléphone' : 'En ligne'}, ${people}${bots ? ` + ${bots}` : ''}`;
}

/** How it ended: won or lost (solo), its rounds, or not finished. */
function outcome(g: UsageGame): { text: string; tone: 'won' | 'plain' } {
  if (!g.end) return { text: 'Pas finie', tone: 'plain' };
  if (g.end.won === true) return { text: 'Gagnée', tone: 'won' };
  if (g.end.won === false) return { text: 'Perdue', tone: 'plain' };
  return { text: plural(g.end.rounds, 'manche', 'manches'), tone: 'plain' };
}

function gameRow(g: UsageGame, withDay: boolean): string {
  const o = outcome(g);
  const bits = [
    withDay ? dayName(g.day, true) : '',
    g.level && g.bots > 0 ? (NAMES[g.level] ?? g.level) : '',
    NAMES[g.preset] ?? g.preset,
    g.rulesChanged ? 'règles changées' : '',
    g.end ? `${g.end.minutes} min` : '',
  ].filter(Boolean);
  const inner = `<span class="t">${esc(g.start ?? '—')}</span><span class="d">${esc(gameTitle(g))}<small>${esc(
    bits.join(' · '),
  )}</small></span><span class="pill ${o.tone}">${esc(o.text)}</span>`;
  return `<li>${g.id ? `<a class="game" href="?game=${esc(g.id)}">${inner}</a>` : `<div class="game">${inner}</div>`}</li>`;
}

function gameList(games: readonly UsageGame[], withDay: boolean): string {
  return games.length === 0
    ? '<p class="empty">Aucune partie.</p>'
    : `<ul class="games">${games.map((g) => gameRow(g, withDay)).join('')}</ul>`;
}

/** The way back, and out: the site's home, the game, the statistics, signing out. */
function nav(who: string, back?: { href: string; label: string }): string {
  return `<nav class="nav" aria-label="Aller">${back ? `<a href="${esc(back.href)}">← ${esc(back.label)}</a>` : ''}<a href="/">Accueil</a><a href="/play/">Jouer</a><form method="post" action="logout"><span class="who">${esc(who)}</span><button type="submit">Se déconnecter</button></form></nav>`;
}

function dayChart(s: UsageSummary): string {
  const max = Math.max(1, ...s.days.map((d) => d.started));
  const bars = s.days
    .map((d) => {
      const h = ((d.started / max) * 100).toFixed(1);
      const label = `${dayName(d.day)} : ${d.started} lancées, ${d.ended} terminées, ${d.rooms} salles, ${d.joins} arrivées`;
      return `<li><a href="?day=${d.day}" title="${esc(label)}"><i style="height:${h}%"></i><span class="sr">${esc(label)}</span></a></li>`;
    })
    .join('');
  const first = s.days[0]?.day;
  const last = s.days.at(-1)?.day;
  return `<section class="card wide"><h3>Parties lancées par jour</h3><p class="note">Touche une barre pour voir les parties de ce jour.</p><ol class="chart">${bars}</ol><p class="axis"><span>${first ? esc(dayName(first, true)) : ''}</span><span>${last ? esc(dayName(last, true)) : ''}</span></p></section>`;
}

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/** When people play: the hours of the day (Paris time) and the days of the week. */
function whenCard(s: UsageSummary): string {
  const hmax = Math.max(1, ...s.hours);
  const timed = s.hours.reduce((a, b) => a + b, 0);
  const hours = s.hours
    .map(
      (n, h) => `<i style="opacity:${n === 0 ? 0.08 : (0.2 + (0.8 * n) / hmax).toFixed(2)}" title="${h} h : ${n}"></i>`,
    )
    .join('');
  const wmax = Math.max(1, ...s.weekdays);
  const week = s.weekdays
    .map(
      (n, i) =>
        `<div title="${WEEKDAYS[i]} : ${n}"><i style="height:${((n / wmax) * 100).toFixed(1)}%"></i><span>${WEEKDAYS[i]}</span></div>`,
    )
    .join('');
  return `<section class="card wide"><h3>Quand on joue</h3>${
    timed === 0
      ? '<p class="note">Les heures arrivent avec les parties lancées depuis le 24 novembre.</p>'
      : `<div class="hours">${hours}</div><p class="axis"><span>0 h</span><span>6 h</span><span>12 h</span><span>18 h</span><span>23 h</span></p>`
  }<div class="week">${week}</div></section>`;
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
    `${nav(who)}
<header><p class="kicker">Tamalou · administration</p><h1>Statistiques</h1></header>
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
${whenCard(s)}
<section class="card wide"><h3>Dernières parties</h3>${gameList(s.games.slice(0, 8), true)}</section>
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

export interface DayPageInput {
  day: string;
  /** The day's figures and games (summarizeUsage over that one day). */
  summary: UsageSummary;
  /** The days before and after, when they are in the kept months and not in the future. */
  prev: string | null;
  next: string | null;
  who: string;
}

/** One day: its figures, then each of its games in order. */
export function dayPage({ day, summary: s, prev, next, who }: DayPageInput): string {
  const kpi = (n: number | string, label: string) =>
    `<div class="kpi"><b>${esc(String(n))}</b><span>${esc(label)}</span></div>`;
  const step = (to: string | null, label: string, sign: string) =>
    to
      ? `<a class="step" href="?day=${to}" aria-label="${label}">${sign}</a>`
      : `<span class="step off">${sign}</span>`;
  return shell(
    capital(dayName(day)),
    `${nav(who, { href: '/admin/', label: 'Statistiques' })}
<header class="day">${step(prev, 'Jour précédent', '‹')}<h1>${esc(capital(dayName(day)))}<small>${esc(
      `${plural(s.totals.started, 'partie', 'parties')} · ${plural(s.totals.rooms, 'salle', 'salles')}`,
    )}</small></h1>${step(next, 'Jour suivant', '›')}</header>
<div class="kpis">
${kpi(s.totals.started, 'lancées')}
${kpi(s.totals.ended, 'terminées')}
${kpi(s.totals.ended === 0 ? '—' : `${one(s.minutes)} min`, 'en moyenne')}
${kpi(s.totals.joins, 'arrivées en salle')}
</div>
<section class="card wide"><h3>Les parties du jour</h3>${gameList([...s.games].reverse(), false)}</section>`,
  );
}

/** One game: when, how long, the table, the device. */
export function gamePage({ game: g, who }: { game: UsageGame; who: string }): string {
  const o = outcome(g);
  const row = (k: string, v: string) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`;
  const c = g.ctx;
  const yes = (b: boolean) => (b ? 'oui' : 'non');
  const setting = (k: keyof typeof SETTING_NAMES, v: string) => SETTING_NAMES[k]?.[v] ?? v;
  const when = g.start
    ? `Lancée à ${g.start}${g.end?.time ? `, finie à ${g.end.time}${g.end.day !== g.day ? ` le ${dayName(g.end.day)}` : ''}` : ''}`
    : 'Heure inconnue (partie d’avant le 24 novembre)';
  return shell(
    gameTitle(g),
    `${nav(who, { href: `?day=${g.day}`, label: capital(dayName(g.day)) })}
<section class="card hero"><p class="kicker">Partie</p><h1>${esc(gameTitle(g))}</h1><p>${esc(when)}</p><span class="pill ${o.tone}">${esc(o.text)}</span></section>
<div class="kpis">
<div class="kpi"><b>${g.end ? `${g.end.minutes} min` : '—'}</b><span>durée</span></div>
<div class="kpi"><b>${g.end ? g.end.rounds : '—'}</b><span>manches</span></div>
<div class="kpi"><b>${g.players}</b><span>à la table</span></div>
</div>
<div class="grid">
<section class="card"><h3>La table</h3><dl>
${row('Mode', NAMES[g.mode] ?? g.mode)}
${row('Joueurs', `${plural(g.humans, 'humain', 'humains')}, ${plural(g.bots, 'bot', 'bots')}`)}
${row('Niveau des bots', g.level && g.bots > 0 ? (NAMES[g.level] ?? g.level) : '—')}
${row('Règles', `${NAMES[g.preset] ?? g.preset}, ${g.rulesChanged ? 'changées' : 'non changées'}`)}
</dl></section>
<section class="card"><h3>L’appareil</h3><dl>
${row('Appareil', `${NAMES[c.device] ?? c.device}, ${(NAMES[c.orientation] ?? c.orientation).toLowerCase()}`)}
${row('Connexion', NAMES[c.connection] ?? c.connection)}
${row('Jeu installé', yes(c.installed))}
${row('Son, vibrations', `${yes(c.sound)}, ${yes(c.haptics)}`)}
${row('Main', setting('hand', c.hand))}
${row('Carte piochée', setting('drawView', c.drawView))}
${row('Rythme, vitesse', `${setting('botPace', c.botPace)}, ${setting('cardSpeed', c.cardSpeed).toLowerCase()}`)}
${row('Langue', NAMES[c.lang] ?? c.lang)}
</dl></section>
</div>`,
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
.kicker{margin:0 0 4px;font-size:.75rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.nav{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.nav>a{display:inline-flex;align-items:center;min-height:40px;padding:0 14px;border-radius:999px;background:var(--surface);color:var(--ink);text-decoration:none;font-weight:700}
.nav form{display:flex;align-items:center;gap:10px;margin-left:auto}
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
.chart li{flex:1;height:100%}
.chart a{display:flex;align-items:flex-end;height:100%}
.chart a:hover i,.chart a:focus-visible i{background:var(--b)}
.chart i{display:block;width:100%;min-height:2px;background:var(--a);border-radius:4px 4px 0 0}
.hours{display:grid;grid-template-columns:repeat(24,minmax(0,1fr));gap:2px}
.hours i{display:block;height:30px;border-radius:3px;background:var(--a)}
.week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;height:90px;margin-top:12px}
.week div{display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px;font-size:.75rem;color:var(--muted)}
.week i{display:block;width:100%;min-height:2px;background:var(--a);border-radius:3px}
.games{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.game{display:grid;grid-template-columns:3.4rem 1fr auto;gap:10px;align-items:center;padding:10px 12px;border-radius:12px;background:var(--bg);color:var(--ink);text-decoration:none}
a.game:hover{outline:2px solid var(--a)}
.game .t{font-weight:800;font-variant-numeric:tabular-nums}
.game .d{font-weight:600;font-size:.92rem}
.game small{display:block;font-weight:400;color:var(--muted);font-size:.8rem}
.pill{font-size:.78rem;font-weight:700;padding:3px 9px;border-radius:999px;background:var(--line);color:var(--ink);white-space:nowrap}
.pill.won{background:#16855a;color:#fff}
.day{display:flex;align-items:center;justify-content:space-between;gap:10px}
.day h1{text-align:center}
.day small{display:block;font-size:.85rem;font-weight:600;color:var(--muted);margin-top:4px}
.step{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:999px;background:var(--surface);color:var(--ink);text-decoration:none;font-size:1.4rem;font-weight:700}
.step.off{opacity:.3}
.hero{display:grid;gap:6px;justify-items:start}
.hero p{margin:0;color:var(--muted)}
dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:6px 12px}
dt{color:var(--muted)}
dd{margin:0;font-weight:600;text-align:right}
.axis{display:flex;justify-content:space-between;margin:6px 0 0;color:var(--muted);font-size:.8rem}
.note,.empty{margin:0 0 8px;color:var(--muted);font-size:.85rem}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.message{max-width:420px;margin:15vh auto 0;text-align:center}
footer{color:var(--muted);font-size:.8rem}
`;
