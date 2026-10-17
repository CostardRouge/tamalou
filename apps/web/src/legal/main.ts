import '@fontsource-variable/bricolage-grotesque/opsz.css';
import '@fontsource-variable/figtree/wght.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '../styles/tokens.css';
import '../landing/landing.css';
import { measurement, setOptOut, startAnalytics, trackPage } from '../audience.ts';
import { rememberLang } from '../i18n/remember.ts';

// The legal notice's script (ADR-0018): the measurement switch, the page's own view, and the language memory of the
// header's language link, as on the home page.

startAnalytics();
trackPage();

/** Shows what this browser does about measurement, and turns counting off or back on (from the next page). */
function mountCount(): void {
  const box = document.getElementById('count');
  if (!box) return;
  const show = () => {
    const state = measurement();
    for (const el of box.querySelectorAll<HTMLElement>('[data-when]')) {
      el.hidden = !(el.dataset.when ?? '').split(' ').includes(state);
    }
  };
  show();
  box.hidden = false;
  document.getElementById('count-toggle')?.addEventListener('click', () => {
    setOptOut(measurement() === 'on');
    show();
  });
}

mountCount();

const lang = document.documentElement.lang === 'en' ? 'en' : 'fr';
document.addEventListener('click', (e) => {
  const a = (e.target as Element).closest<HTMLAnchorElement>('a[href]');
  const to = a?.dataset.lang ?? (/jouer\/$/.test(a?.getAttribute('href') ?? '') ? lang : null);
  if (to === 'en' || to === 'fr') rememberLang(to);
});
