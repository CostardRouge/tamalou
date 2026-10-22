// Where everyone sits on the setup's table and on the deal's felt (the owner's pick on the 2026-10-22 canvas): the
// others spread over the top of an ellipse, left to right, the player alone at the bottom. Positions are percentages
// of the box, so the same seats fit a phone and a desktop. Pure, so the seating and the deal's order are tested.

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

/** The deal's seats: the felt is tall, so a taller ellipse keeps every hand and name clear of its neighbours. */
export const dealSeats = (k: number) => aroundTop(k, 150, 34, 42, 54);

/** Where the player sits on the deal's felt. */
export const ME: Spot = { x: 50, y: 78 };

export interface DealtCard {
  /** Who receives it: 0 is the player, then the others in seat order. */
  seat: number;
  /** Its place in that hand, 0 to 3. */
  slot: number;
  /** Seconds before it leaves the deck: one card at a time, round the table, four rounds. */
  delay: number;
}

/** The deal's order: one card to each player in turn, the player first, four times round. */
export function dealOrder(players: number, cards = 4, gap = 0.045): DealtCard[] {
  const out: DealtCard[] = [];
  for (let slot = 0; slot < cards; slot++)
    for (let seat = 0; seat < players; seat++)
      out.push({ seat, slot, delay: Math.round(out.length * gap * 1000) / 1000 });
  return out;
}

/** How long the deal takes, in milliseconds, before the button says it is done. */
export const dealLength = (players: number, cards = 4) => Math.round(players * cards * 45 + 650);
