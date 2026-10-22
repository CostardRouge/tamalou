import { useSyncExternalStore } from 'react';
import { DEFAULT_HAND, type HandLayout, isHandLayout } from '../game/hand.ts';

// This device's comfort settings: sounds, vibrations and how hands are laid out (game/hand.ts), remembered in
// localStorage (a convenience: a private window simply starts with the defaults). The language lives with the
// dictionaries (i18n/index.ts).

export interface Settings {
  sound: boolean;
  haptics: boolean;
  /** My hand's layout. */
  hand: HandLayout;
  /** The opponents' seats follow it (game/hand.ts, opponentLayout). */
  oppHand: boolean;
}

const KEY = 'tamalou-settings';
const DEFAULTS: Settings = { sound: true, haptics: true, hand: DEFAULT_HAND, oppHand: true };

function load(): Settings {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const data = raw ? (JSON.parse(raw) as Partial<Settings>) : {};
    return {
      sound: typeof data.sound === 'boolean' ? data.sound : DEFAULTS.sound,
      haptics: typeof data.haptics === 'boolean' ? data.haptics : DEFAULTS.haptics,
      hand: isHandLayout(data.hand) ? data.hand : DEFAULTS.hand,
      oppHand: typeof data.oppHand === 'boolean' ? data.oppHand : DEFAULTS.oppHand,
    };
  } catch {
    return DEFAULTS;
  }
}

let current = load();
const listeners = new Set<() => void>();

export const getSettings = () => current;

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(current));
  } catch {
    // Not remembered; it still applies until the page closes.
  }
  for (const fn of listeners) fn();
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, getSettings);
}
