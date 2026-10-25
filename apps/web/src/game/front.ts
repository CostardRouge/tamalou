// Where a drawn card is shown (the owner's picks on the 2026-10-25 canvas, "la carte piochée"): another player's
// in front of their seat, face down for everyone else, as a card they hold up to look at; mine either held just above
// my hand ("held", the default) or large in the middle of the table ("big"), a device setting. Pure geometry: boxes
// in, a position out; FrontCard.tsx and DrawStage.tsx measure the table and place the card.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type DrawView = 'held' | 'big';
export const DRAW_VIEWS: readonly DrawView[] = ['held', 'big'];
export const DEFAULT_DRAW_VIEW: DrawView = 'held';
export const isDrawView = (v: unknown): v is DrawView => DRAW_VIEWS.includes(v as DrawView);

const GAP = 6;
const EDGE = 4;

/** The way from a seat to the middle of the table, as a unit vector (down when they coincide). */
export function towards(seat: Rect, middle: Rect): { dx: number; dy: number } {
  const dx = middle.x + middle.w / 2 - (seat.x + seat.w / 2);
  const dy = middle.y + middle.h / 2 - (seat.y + seat.h / 2);
  const len = Math.hypot(dx, dy);
  return len < 1 ? { dx: 0, dy: 1 } : { dx: dx / len, dy: dy / len };
}

/**
 * Which way a player's cards face (the owner, 2026-10-25: the T on the back of the others' cards turned their way),
 * in degrees clockwise from mine: turned round for a seat beyond the middle of the table, as mine for one on my side.
 * Never a quarter turn: the owner found a T lying on its side wrong even at the ends of a wide table, whose seats sit
 * beyond the middle too.
 */
export function facing(seat: Rect, middle: Rect): number {
  return towards(seat, middle).dy > 0 ? 180 : 0;
}

/**
 * Another player's drawn card: just off their seat, on the side that faces the middle of the table (below a seat at
 * the top of a phone, beside one at the end of the wide table's oval), kept on the screen.
 */
export function frontOf(seat: Rect, middle: Rect, card: { w: number; h: number }, screen: { w: number; h: number }) {
  const sx = seat.x + seat.w / 2;
  const sy = seat.y + seat.h / 2;
  const { dx, dy } = towards(seat, middle);
  // Where the line to the middle leaves the seat, then far enough along it for the card to clear the seat.
  const t = Math.min(dx === 0 ? Infinity : seat.w / 2 / Math.abs(dx), dy === 0 ? Infinity : seat.h / 2 / Math.abs(dy));
  const reach = (Math.abs(dx) * card.w) / 2 + (Math.abs(dy) * card.h) / 2 + GAP;
  const cx = sx + dx * (t + reach);
  const cy = sy + dy * (t + reach);
  return {
    x: clamp(cx - card.w / 2, EDGE, screen.w - card.w - EDGE),
    y: clamp(cy - card.h / 2, EDGE, screen.h - card.h - EDGE),
  };
}

/**
 * My drawn card shown large: in the open part of the table where it can be largest without covering the piles, my
 * hand or the buttons, which stay usable over the dimming. On a phone that is the band above the piles (over the
 * others' seats); on a wide table, the felt beside the piles.
 */
export function stageOf(
  table: { bar: Rect; piles: Rect; mine: Rect; screen: { w: number; h: number } },
  caption: number,
  maxW = 210,
) {
  const { bar, piles, mine, screen } = table;
  const top = bar.y + bar.h + 10;
  const fit = (w: number, h: number) => Math.max(0, Math.min(maxW, w, (h - caption) / 1.4));
  // Above the piles, across the screen.
  const above = { w: fit(screen.w * 0.7, piles.y - top - 10), cx: screen.w / 2, top, bottom: piles.y - 10 };
  // Beside the piles, on the left, down to my hand: only where the caption fits there too (a wide table).
  const sideRight = piles.x - 20;
  const roomy = sideRight - 24 >= 260;
  const side = {
    w: roomy ? fit(sideRight - 24, mine.y - top - 10) : 0,
    cx: (24 + sideRight) / 2,
    top,
    bottom: mine.y - 10,
  };
  const best = side.w > above.w ? side : above;
  const h = best.w * 1.4;
  return {
    x: best.cx - best.w / 2,
    y: Math.max(top, best.top + (best.bottom - best.top - h - caption) / 2),
    w: best.w,
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
