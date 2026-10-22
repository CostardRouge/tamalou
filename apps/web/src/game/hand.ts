import type { CSSProperties } from 'react';

// How a hand is laid out on screen: a comfort setting of this device, never a rule (the engine's slots keep their
// numbers, and the game master's columns only shape the grid). The owner picked the six layouts on the 2026-10-22
// canvas, the row as the default. app.css draws each one from the class and the custom properties written here; the
// arc and the fan need trigonometry, so their geometry is computed (and tested) here rather than guessed in CSS.

export const HAND_LAYOUTS = ['grid', 'row', 'flat', 'arc', 'fan', 'carousel'] as const;
export type HandLayout = (typeof HAND_LAYOUTS)[number];
export const DEFAULT_HAND: HandLayout = 'row';

export const isHandLayout = (v: unknown): v is HandLayout => HAND_LAYOUTS.includes(v as HandLayout);

/**
 * What an opponent's seat shows: my hand's family when they follow it, else the grid. A carousel or cards laid down in
 * perspective would not fit a small seat, so they become a row there.
 */
export function opponentLayout(mine: HandLayout, follow: boolean): HandLayout {
  if (!follow) return 'grid';
  return mine === 'flat' || mine === 'carousel' ? 'row' : mine;
}

/** An arc or a fan: every card turns about one pivot below the hand. Lengths are in card widths, angles in degrees. */
export interface Curve {
  /** Between two neighbouring cards. */
  step: number;
  /** From the foot of a card down to the pivot. */
  pivot: number;
  /** The whole hand's width, corners of the outer cards included. */
  span: number;
  /** How far the outer cards' lowest corners drop below a straight card's foot. */
  sag: number;
}

const round = (v: number) => Math.round(v * 1000) / 1000;
const RAD = Math.PI / 180;

/**
 * The arc keeps its cards apart while they fit (centres 1.1 widths apart, `tight`: 0.75, for a small seat), then closes
 * up so the hand stays within a fixed width; the fan overlaps from the start, 11° apart at most, 46° end to end.
 */
export function curve(layout: 'arc' | 'fan', n: number, tight = false): Curve {
  const gaps = Math.max(1, n - 1);
  const pivot = layout === 'arc' ? 7.5 : 3;
  // A card's centre sits 0.7 widths above its foot.
  const centre = pivot + 0.7;
  const apart = tight ? Math.min(0.75, 2.5 / gaps) : Math.min(1.1, 3.3 / gaps);
  const step = layout === 'arc' ? Math.asin(apart / centre) / RAD : Math.min(11, 46 / gaps);
  const edge = ((n - 1) / 2) * step * RAD;
  // The outer card's top corner reaches furthest out, its bottom corner lowest.
  const span = 2 * ((pivot + 1.4) * Math.sin(edge) + 0.5 * Math.cos(edge));
  const sag = pivot * (1 - Math.cos(edge)) + 0.5 * Math.sin(edge);
  return { step: round(step), pivot, span: round(span), sag: round(sag) };
}

/** The hand's box: its classes and the custom properties app.css reads (`--n`, `--cols`, the curve's). */
export function handFrame(
  layout: HandLayout,
  n: number,
  cols: number,
  /** An opponent's seat: an arc or a fan is seen from across the table, its pivot by their name. */
  across = false,
): { className: string; style: CSSProperties } {
  const style: Record<string, number> = { '--n': n, '--cols': cols };
  const curved = layout === 'arc' || layout === 'fan';
  if (curved) {
    const c = curve(layout, n, across);
    Object.assign(style, { '--step': c.step, '--pivot': c.pivot, '--span': c.span, '--sag': c.sag });
  }
  const className = `${layout === 'grid' ? 'grid ' : ''}hand lay-${layout}${curved && across ? ' lay-across' : ''}`;
  return { className, style: style as CSSProperties };
}

/** One card's place in its hand: how far from the middle it sits, in cards (the curves turn it by that many steps). */
export const slotStyle = (i: number, n: number): CSSProperties => ({ '--k': i - (n - 1) / 2 }) as CSSProperties;
