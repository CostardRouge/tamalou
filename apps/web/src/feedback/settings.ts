import { useSyncExternalStore } from 'react';
import { DEFAULT_DRAW_VIEW, type DrawView, isDrawView } from '../game/front.ts';
import { DEFAULT_HAND, type HandLayout, isHandLayout } from '../game/hand.ts';
import { type CardSpeed, isCardSpeed, isPace, type Pace } from '../game/pace.ts';

// This device's comfort settings: sounds, vibrations, how hands are laid out (game/hand.ts), and how the others are
// watched (the bots' pace, their hands, the cards' speed: game/pace.ts), how my drawn card shows (game/front.ts), remembered in localStorage (a convenience: a
// private window simply starts with the defaults). The language lives with the dictionaries (i18n/index.ts).

export interface Settings {
  sound: boolean;
  haptics: boolean;
  /** My hand's layout. */
  hand: HandLayout;
  /** The opponents' seats follow it (game/hand.ts, opponentLayout). */
  oppHand: boolean;
  /** How long the bots take between two moves. */
  botPace: Pace;
  /** The others' moves are played by a hand: a named cursor, or a fingertip on a touch screen. */
  showHands: boolean;
  /** How fast cards fly and hands move. */
  cardSpeed: CardSpeed;
  /** My drawn card: held just above my hand, or large in the middle of the table. */
  drawView: DrawView;
}

const KEY = 'tamalou-settings';
const DEFAULTS: Settings = {
  sound: true,
  haptics: true,
  hand: DEFAULT_HAND,
  oppHand: true,
  botPace: 'normal',
  showHands: true,
  cardSpeed: 'normal',
  drawView: DEFAULT_DRAW_VIEW,
};

function load(): Settings {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const data = raw ? (JSON.parse(raw) as Partial<Settings>) : {};
    return {
      sound: typeof data.sound === 'boolean' ? data.sound : DEFAULTS.sound,
      haptics: typeof data.haptics === 'boolean' ? data.haptics : DEFAULTS.haptics,
      hand: isHandLayout(data.hand) ? data.hand : DEFAULTS.hand,
      oppHand: typeof data.oppHand === 'boolean' ? data.oppHand : DEFAULTS.oppHand,
      botPace: isPace(data.botPace) ? data.botPace : DEFAULTS.botPace,
      showHands: typeof data.showHands === 'boolean' ? data.showHands : DEFAULTS.showHands,
      cardSpeed: isCardSpeed(data.cardSpeed) ? data.cardSpeed : DEFAULTS.cardSpeed,
      drawView: isDrawView(data.drawView) ? data.drawView : DEFAULTS.drawView,
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
