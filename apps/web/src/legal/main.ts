import '@fontsource-variable/bricolage-grotesque/opsz.css';
import '@fontsource-variable/figtree/wght.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '../styles/tokens.css';
import '../styles/lang.css';
import '../landing/landing.css';
import { measurement, setOptOut, startAnalytics, trackPage } from '../audience.ts';
import { pageLang, startLanguageMenu } from '../landing/menu.ts';

// The legal notice's script (ADR-0018): the measurement switch, the page's own view, and the header's language menu,
// as on the home page.

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

startLanguageMenu(pageLang());
