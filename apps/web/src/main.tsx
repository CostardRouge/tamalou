import '@fontsource-variable/bricolage-grotesque/opsz.css';
import '@fontsource-variable/figtree/wght.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import './styles/tokens.css';
import './styles/app.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { unlockAudioOnFirstTap } from './feedback/sound.ts';
import { currentLang } from './i18n/index.ts';
import { startPwa } from './pwa.ts';

document.documentElement.lang = currentLang();
unlockAudioOnFirstTap();
startPwa();

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
