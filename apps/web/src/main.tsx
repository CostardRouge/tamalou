import '@fontsource-variable/bricolage-grotesque/opsz.css';
import '@fontsource-variable/figtree/wght.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import './styles/tokens.css';
import './styles/lang.css';
import './styles/cards.css';
import './styles/app.css';
import { language } from '@tamalou/shared/languages';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { startAnalytics, trackPage } from './audience.ts';
import { unlockAudioOnFirstTap } from './feedback/sound.ts';
import { currentLang, ready } from './i18n/index.ts';
import { startPwa } from './pwa.ts';

unlockAudioOnFirstTap();
startPwa();
startAnalytics();
trackPage();

// The screen waits for the language's dictionary (ADR-0028): at once for French and English, in the bundle; from the
// service worker's cache or the network, a fraction of a second, for the others.
void ready.then(() => {
  document.documentElement.lang = language(currentLang()).html;
  const root = document.getElementById('root');
  if (root) {
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  }
});
