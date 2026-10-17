import '@fontsource-variable/bricolage-grotesque/opsz.css';
import '@fontsource-variable/figtree/wght.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '../styles/tokens.css';
import '../styles/cards.css';
import './landing.css';
import { MotionConfig } from 'motion/react';
import { StrictMode } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { startAnalytics, trackPage } from '../audience.ts';
import { CardView } from '../cards/CardView.tsx';
import { setLang } from '../i18n/index.ts';
import { cardOf, LiveTable } from './live.tsx';
import { LANDING } from './text.ts';

// The home page's script (ADR-0016). The words are already in the page (markup.ts); this brings what moves: the live
// table, the cards beside the values and the powers (drawn by the card theme), and the preset buttons.

startAnalytics();
trackPage();

const lang = document.documentElement.lang === 'en' ? 'en' : 'fr';
// The cards' letters follow the page (V D R or J Q K), without changing the language the game remembers.
setLang(lang, false);
// The game opens in the language of the home page the visitor played from, or switched to.
document.addEventListener('click', (e) => {
  const a = (e.target as Element).closest<HTMLAnchorElement>('a[href]');
  if (!a) return;
  const to = a.dataset.lang ?? (/jouer\/$/.test(a.getAttribute('href') ?? '') ? lang : null);
  if (to === 'en' || to === 'fr') setLang(to);
});

const live = document.getElementById('live');
const slots = [...document.querySelectorAll<HTMLElement>('[data-card]')];
if (live) {
  createRoot(live).render(
    <StrictMode>
      <MotionConfig reducedMotion="user">
        <LiveTable text={LANDING[lang]} steps={document.getElementById('live-steps')} />
        {slots.map((el, i) => createPortal(<CardView card={cardOf(el.dataset.card ?? '', 100 + i)} label="" />, el))}
      </MotionConfig>
    </StrictMode>,
  );
}

// "Your rules, your table": one preset's summary at a time.
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-preset]')) {
  button.addEventListener('click', () => {
    for (const b of document.querySelectorAll<HTMLButtonElement>('[data-preset]'))
      b.setAttribute('aria-pressed', String(b === button));
    for (const card of document.querySelectorAll<HTMLElement>('[data-preset-card]'))
      card.hidden = card.dataset.presetCard !== button.dataset.preset;
  });
}
