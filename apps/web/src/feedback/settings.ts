import { useSyncExternalStore } from 'react';

// This device's comfort settings: sounds and vibrations, remembered in localStorage (a convenience: a private window
// simply starts with both on). The language lives with the dictionaries (i18n/index.ts).

export interface Settings {
  sound: boolean;
  haptics: boolean;
}

const KEY = 'tamalou-settings';
const DEFAULTS: Settings = { sound: true, haptics: true };

function load(): Settings {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const data = raw ? (JSON.parse(raw) as Partial<Settings>) : {};
    return {
      sound: typeof data.sound === 'boolean' ? data.sound : DEFAULTS.sound,
      haptics: typeof data.haptics === 'boolean' ? data.haptics : DEFAULTS.haptics,
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
