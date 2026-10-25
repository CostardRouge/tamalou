// How the others are watched (the owner's picks on the 2026-10-24 canvas): the bots' pace, the hand that plays the
// others' moves, and the cards' speed, all settings of this device. The pace stretches the time a bot waits before a
// turn's move (never its reaction to a quick discard, which would change who wins it); the speed scales every spring.

export const PACES = ['fast', 'normal', 'slow'] as const;
export type Pace = (typeof PACES)[number];

export const CARD_SPEEDS = ['fast', 'normal', 'soft'] as const;
export type CardSpeed = (typeof CARD_SPEEDS)[number];

/** What a bot's turn delay is multiplied by. */
export const PACE_FACTOR: Record<Pace, number> = { fast: 0.55, normal: 1, slow: 1.7 };

/** What springs are sped up by: stiffness grows with its square, waits shrink with it. */
export const SPEED_FACTOR: Record<CardSpeed, number> = { fast: 1.35, normal: 1, soft: 0.7 };

export const isPace = (v: unknown): v is Pace => PACES.includes(v as Pace);
export const isCardSpeed = (v: unknown): v is CardSpeed => CARD_SPEEDS.includes(v as CardSpeed);

/** A mouse or a trackpad shows a named cursor; a finger on a touch screen, a fingertip. */
export type HandKind = 'cursor' | 'finger';

export function handKind(): HandKind {
  try {
    return globalThis.matchMedia?.('(hover: hover) and (pointer: fine)').matches ? 'cursor' : 'finger';
  } catch {
    return 'finger';
  }
}
