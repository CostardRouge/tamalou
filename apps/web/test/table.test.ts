import { describe, expect, it } from 'vitest';
import { aroundTop, dealLength, dealOrder, dealSeats } from '../src/home/table.ts';

describe('the setup table', () => {
  it('seats one opponent at the top, in the middle', () => {
    expect(aroundTop(1)).toEqual([{ x: 50, y: 12 }]);
  });

  it('spreads the others from left to right over the top, symmetrically', () => {
    const five = aroundTop(5);
    expect(five.map((s) => s.x)).toEqual([...five.map((s) => s.x)].sort((a, b) => a - b));
    expect(five[2]).toEqual({ x: 50, y: 12 });
    expect(five[0]?.y).toBe(five[4]?.y);
    expect((five[0]?.x ?? 0) + (five[4]?.x ?? 0)).toBeCloseTo(100, 5);
    for (const s of five) expect(s.y).toBeLessThan(50);
  });

  it('seats the deal on a taller ellipse, inside the felt', () => {
    for (const s of dealSeats(5)) {
      expect(s.x).toBeGreaterThan(15);
      expect(s.x).toBeLessThan(85);
      expect(s.y).toBeGreaterThan(10);
    }
  });

  it('deals one card at a time round the table, the player first, four times', () => {
    const order = dealOrder(3);
    expect(order).toHaveLength(12);
    expect(order.slice(0, 4).map((c) => [c.seat, c.slot])).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
    ]);
    expect(order.at(-1)).toEqual({ seat: 2, slot: 3, delay: 0.495 });
    expect(dealLength(3)).toBeGreaterThan((order.at(-1)?.delay ?? 0) * 1000 + 500);
  });
});
