import type { RuleSetInput } from '@tamalou/shared';

// The ways to play from this device, and what each one changes in the rules before the game master's own changes.

export type Mode = 'solo' | 'pass';

/** A mode's defaults (ADR-0005): one screen cannot show a hidden race fairly, so pass-and-play starts without it. */
export const MODE_DEFAULTS: Record<Mode, RuleSetInput> = {
  solo: {},
  pass: { quickDiscard: { enabled: false } },
};

export const MAX_SEATS = 6;
