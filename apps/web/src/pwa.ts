import { useSyncExternalStore } from 'react';
import { trackEvent } from './audience.ts';

/**
 * The installable, offline game (ADR-0015, ADR-0020). Production builds register the service worker (src/sw/sw.ts,
 * built by build/pwa.ts). A new version waits for the player: the home screen offers to reload, or later, so a deploy
 * never cuts a game. The install button shows only when the browser offers installation (Chromium, on desktop and
 * Android); Safari on iPhone and iPad gets the words to do it by hand.
 */

/** Chromium's `beforeinstallprompt` event, missing from the DOM types. */
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
}

export interface PwaState {
  /** The browser offers to install the game: show the button. */
  canInstall: boolean;
  /** A new version is installed and waiting for the player's word. */
  updateReady: boolean;
  /** The game was installed from this page just now. */
  installed: boolean;
  /** Safari on iPhone or iPad, in a tab: installing goes through Share → Add to Home Screen. */
  iosHint: boolean;
}

/** The icon's shortcuts the game answers (SHORTCUTS in build/site.ts; a test ties the two lists). */
export const SHORTCUT_KEYS = ['solo', 'pass'] as const;
export type Shortcut = (typeof SHORTCUT_KEYS)[number];

/** An installed game can stay open for days: look for a new version when it comes back, at most hourly. */
const UPDATE_EVERY = 60 * 60 * 1000;

let state: PwaState = { canInstall: false, updateReady: false, installed: false, iosHint: false };
let installPrompt: InstallPrompt | null = null;
let waiting: ServiceWorker | null = null;
/** Set when the player asked for the new version, so the page reloads once it takes over (and only then). */
let reloading = false;
const listeners = new Set<() => void>();

function set(patch: Partial<PwaState>): void {
  state = { ...state, ...patch };
  for (const fn of listeners) fn();
}

export function startPwa(): void {
  globalThis.addEventListener?.('beforeinstallprompt', (e) => {
    // Our own button instead of Chrome's mini-infobar on Android.
    e.preventDefault();
    installPrompt = e as InstallPrompt;
    set({ canInstall: true });
  });
  globalThis.addEventListener?.('appinstalled', () => {
    trackEvent('app-installed');
    installPrompt = null;
    set({ canInstall: false, installed: true, iosHint: false });
    void persist();
  });
  if (isStandalone()) void persist();
  else if (isIos()) set({ iosHint: true });
  const sw = globalThis.navigator?.serviceWorker;
  if (!import.meta.env.PROD || !sw) return;
  // After the page's own downloads, so storing the files doesn't compete with the first render.
  if (document.readyState === 'complete') void register(sw);
  else globalThis.addEventListener('load', () => void register(sw), { once: true });
}

async function register(sw: ServiceWorkerContainer): Promise<void> {
  try {
    // The game lives in play/; the worker sits at the site's root and keeps every page (ADR-0017).
    const reg = await sw.register('../sw.js', { scope: '../' });
    // The first install has no controller to replace: nothing to offer.
    if (reg.waiting && sw.controller) offerUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const next = reg.installing;
      next?.addEventListener('statechange', () => {
        if (next.state === 'installed' && sw.controller) offerUpdate(next);
      });
    });
    sw.addEventListener('controllerchange', () => {
      if (reloading) location.reload();
    });
    let checked = Date.now();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || Date.now() - checked < UPDATE_EVERY) return;
      checked = Date.now();
      reg.update().catch(() => {});
    });
  } catch {
    // No service worker (private mode, an old browser): the game still works online.
  }
}

/** A worker installed and waiting: the home screen offers it. */
function offerUpdate(worker: ServiceWorker): void {
  waiting = worker;
  set({ updateReady: true });
}

/** Reload: the waiting worker takes over, then the page reloads (on `controllerchange`). */
export function applyUpdate(): void {
  if (!waiting) return;
  reloading = true;
  // Another tab may already have asked it to take over, in which case only this page is left to reload.
  if (waiting.state === 'installed') waiting.postMessage('skip-waiting');
  else location.reload();
}

/** Later: the new version starts once every tab of the game is closed. */
export function dismissUpdate(): void {
  waiting = null;
  set({ updateReady: false });
}

export async function install(): Promise<void> {
  const prompt = installPrompt;
  if (!prompt) return;
  // The event can be used once; Chromium fires a new one if the player declines.
  installPrompt = null;
  set({ canInstall: false });
  try {
    await prompt.prompt();
  } catch {
    // Already shown or refused by the browser: the address bar still offers installation.
  }
}

/**
 * The shortcut the icon's menu opened the game with (`?shortcut=solo`), read once and dropped from the address so
 * a reload comes back to the home screen; anything else in the address (`?lang=`, `#room=`) stays.
 */
export function readShortcut(): Shortcut | null {
  const loc = globalThis.location;
  if (!loc) return null;
  const url = new URL(loc.href);
  const key = url.searchParams.get('shortcut');
  if (key === null) return null;
  url.searchParams.delete('shortcut');
  history.replaceState(null, '', url.pathname + url.search + url.hash);
  return (SHORTCUT_KEYS as readonly string[]).includes(key) ? (key as Shortcut) : null;
}

/** Opened from the home screen or as an installed window rather than in a browser tab. */
function isStandalone(): boolean {
  return (
    (globalThis.navigator as Navigator & { standalone?: boolean })?.standalone === true ||
    (typeof globalThis.matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches)
  );
}

/** Safari on iPhone or iPad (which calls itself a Mac, but has a touch screen). */
function isIos(): boolean {
  const nav = globalThis.navigator;
  if (!nav) return false;
  return /iPhone|iPad|iPod/.test(nav.userAgent) || (/Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1);
}

/** Asks the browser not to evict the game's files and settings under storage pressure. Granted silently to installed apps. */
async function persist(): Promise<void> {
  try {
    await globalThis.navigator?.storage?.persist?.();
  } catch {
    // Best effort.
  }
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const snapshot = () => state;

export function usePwa(): PwaState {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
