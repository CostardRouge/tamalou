import { useSyncExternalStore } from 'react';

// The installable, offline game (M8): registers the service worker built by build/pwa.ts (production builds only),
// says when a new version is waiting, and keeps the browser's install prompt for the home screen's button.

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
}

let installPrompt: InstallPrompt | null = null;
let updateReady = false;
const listeners = new Set<() => void>();
const notify = () => {
  for (const fn of listeners) fn();
};

export function startPwa(): void {
  globalThis.addEventListener?.('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e as InstallPrompt;
    notify();
  });
  globalThis.addEventListener?.('appinstalled', () => {
    installPrompt = null;
    notify();
  });
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  // Only a page that an older version already served has something to reload: the very first install takes control
  // too (clients.claim), and must not announce an update.
  const hadController = navigator.serviceWorker.controller !== null;
  navigator.serviceWorker
    .register('./sw.js')
    .then((reg) => {
      reg.addEventListener('updatefound', () => {
        const next = reg.installing;
        next?.addEventListener('statechange', () => {
          // A new version replaced one already running: offer a reload rather than cutting a game short.
          if (next.state === 'activated' && hadController) {
            updateReady = true;
            notify();
          }
        });
      });
    })
    .catch(() => {
      // No service worker (private mode, an old browser): the game still works online.
    });
}

export async function install(): Promise<void> {
  const p = installPrompt;
  installPrompt = null;
  notify();
  await p?.prompt();
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const snapshot = () => `${installPrompt ? 'i' : ''}${updateReady ? 'u' : ''}`;

export function usePwa(): { canInstall: boolean; updateReady: boolean } {
  const s = useSyncExternalStore(subscribe, snapshot, snapshot);
  return { canInstall: s.includes('i'), updateReady: s.includes('u') };
}
