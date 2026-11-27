import '@fontsource-variable/bricolage-grotesque/opsz.css';
import '@fontsource-variable/figtree/wght.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '../styles/tokens.css';
import '../styles/lang.css';
import '../styles/cards.css';
import './landing.css';
import { MotionConfig } from 'motion/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { startAnalytics, trackPage } from '../audience.ts';
import { setLang } from '../i18n/index.ts';
import { offerLanguage, pageLang, startLanguageMenu } from './menu.ts';
import { Quiz } from './quiz.tsx';
import type { LandingText } from './text/fr.ts';
import { Tutorial } from './tutorial.tsx';

// The home page's script (ADR-0017). The words are already in the page (markup.ts); this brings what moves: the first
// round against Malo and the hand quiz, their cards drawn by the card theme.

startAnalytics();
trackPage();

const lang = pageLang();
// The cards' letters follow the page (V D R or J Q K), without changing the language the game remembers.
const letters = setLang(lang, false);
startLanguageMenu(lang);
offerLanguage(lang);

/** Each language's words are a file of their own: this page fetches its own only (ADR-0028). */
const TEXTS = import.meta.glob<LandingText>(['./text/*.ts', '!./text/index.ts'], { import: 'default' });
const text = await Promise.all([TEXTS[`./text/${lang}.ts`]?.() ?? TEXTS['./text/fr.ts']?.(), letters]).then(([t]) => t);
const round = document.getElementById('manche');
if (round && text) {
  createRoot(round).render(
    <StrictMode>
      <MotionConfig reducedMotion="user">
        <Tutorial text={text} play={round.dataset.play ?? 'play/'} />
      </MotionConfig>
    </StrictMode>,
  );
}
const quiz = document.getElementById('quiz');
if (quiz && text) {
  createRoot(quiz).render(
    <StrictMode>
      <Quiz text={text} />
    </StrictMode>,
  );
}
