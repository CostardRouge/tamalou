import { describe, expect, it } from 'vitest';
import { aroundTop } from '../src/home/table.ts';

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
});
