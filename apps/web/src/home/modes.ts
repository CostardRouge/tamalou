import { MAX_PLAYERS, tableFits } from '@tamalou/engine';
import { type RuleSetInput, rulesOf } from '@tamalou/shared';
import type { GameChoice } from './HomeScreen.tsx';

// The ways to play from this device, and what each one changes in the rules before the game master's own changes.

export type Mode = 'solo' | 'pass' | 'online';

/** A mode's defaults (ADR-0005): one screen cannot show a hidden race fairly, so pass-and-play starts without it. */
export const MODE_DEFAULTS: Record<Mode, RuleSetInput> = {
  solo: {},
  pass: { quickDiscard: { enabled: false } },
  // Online rules are the room's, set in its lobby: the home screen does not edit them.
  online: {},
};

/** The engine's limit: ten since 2026-11-21. */
export const MAX_SEATS = MAX_PLAYERS;

/** How many sit at this table. */
export const seatsOf = (c: GameChoice) => (c.mode === 'pass' ? c.players.length : 1) + c.bots;

/** Whether the chosen rules hold enough cards for this table (ten players with large hands need two decks). */
export const fitsTable = (c: GameChoice) =>
  tableFits(seatsOf(c), rulesOf({ preset: c.preset, overrides: c.overrides }, MODE_DEFAULTS[c.mode]));
