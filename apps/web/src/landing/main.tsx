import '@fontsource-variable/bricolage-grotesque/opsz.css';
import '@fontsource-variable/figtree/wght.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '../styles/tokens.css';
import '../styles/cards.css';
import './landing.css';
import { MotionConfig } from 'motion/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { startAnalytics, trackPage } from '../audience.ts';
import { setLang } from '../i18n/index.ts';
import { Quiz } from './quiz.tsx';
import { LANDING } from './text.ts';
import { Tutorial } from './tutorial.tsx';

// The home page's script (ADR-0017). The words are already in the page (markup.ts); this brings what moves: the first
// round against Malo and the hand quiz, their cards drawn by the card theme.

startAnalytics();
trackPage();

const lang = document.documentElement.lang === 'en' ? 'en' : 'fr';
// The cards' letters follow the page (V D R or J Q K), without changing the language the game remembers.
setLang(lang, false);
// The game opens in the language of the home page the visitor played from, or switched to.
document.addEventListener('click', (e) => {
  const a = (e.target as Element).closest<HTMLAnchorElement>('a[href]');
  if (!a) return;
  const to = a.dataset.lang ?? (/play\/$/.test(a.getAttribute('href') ?? '') ? lang : null);
  if (to === 'en' || to === 'fr') setLang(to);
});

const text = LANDING[lang];
const round = document.getElementById('manche');
if (round) {
  createRoot(round).render(
    <StrictMode>
      <MotionConfig reducedMotion="user">
        <Tutorial text={text} play={round.dataset.play ?? 'play/'} />
      </MotionConfig>
    </StrictMode>,
  );
}
const quiz = document.getElementById('quiz');
if (quiz) {
  createRoot(quiz).render(
    <StrictMode>
      <Quiz text={text} />
    </StrictMode>,
  );
}
