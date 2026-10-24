// Where everyone sits on the setup's table and, on a wide screen, at the game's table (the owner's pick on the
// 2026-10-22 canvas): the others spread over the top of an ellipse, left to right, the player alone at the bottom.
// Positions are percentages of the box, so the same seats fit any size. Pure, so the seating is tested.

export interface Spot {
  /** Percent of the box's width. */
  x: number;
  /** Percent of the box's height. */
  y: number;
}

const round = (v: number) => Math.round(v * 10) / 10;

/**
 * `k` seats over the top of an ellipse centred at (50, cy), radii `rx` and `ry` in percent, from left to right,
 * `spread` degrees from the first to the last.
 */
export function aroundTop(k: number, spread = 148, rx = 38, ry = 38, cy = 50): Spot[] {
  return Array.from({ length: k }, (_, i) => {
    const deg = k === 1 ? 270 : 270 - spread / 2 + (spread * i) / (k - 1);
    const a = (deg * Math.PI) / 180;
    return { x: round(50 + rx * Math.cos(a)), y: round(cy + ry * Math.sin(a)) };
  });
}

/**
 * The game's seats on a wide screen (app.css, the wide table): the others round the top half of the table, the first
 * and last at its sides once there are four or more, so the width of a desktop holds them all.
 */
export const tableSeats = (k: number) => aroundTop(k, Math.min(180, 60 + 30 * k), 38, 44, 58);
