import { describe, expect, it } from 'vitest';
import { facing, frontOf, isDrawView, stageOf } from '../src/game/front.ts';

const card = { w: 50, h: 70 };

describe('a drawn card in front of its player', () => {
  it('sits under a seat at the top of a phone, clear of it', () => {
    const seat = { x: 83, y: 74, w: 109, h: 69 };
    const at = frontOf(seat, { x: 12, y: 149, w: 366, h: 415 }, card, { w: 390, h: 844 });
    expect(at.y).toBeGreaterThanOrEqual(seat.y + seat.h);
    expect(at.x + card.w / 2).toBeGreaterThan(seat.x);
    expect(at.x + card.w / 2).toBeLessThan(seat.x + seat.w + 20);
  });

  it('sits beside a seat at the end of the wide table, towards the middle', () => {
    const seat = { x: 132, y: 148, w: 206, h: 103 };
    const at = frontOf(seat, { x: 24, y: 224, w: 1232, h: 157 }, card, { w: 1280, h: 800 });
    expect(at.x).toBeGreaterThanOrEqual(seat.x + seat.w);
    const right = { x: 942, y: 148, w: 206, h: 103 };
    expect(
      frontOf(right, { x: 24, y: 224, w: 1232, h: 157 }, card, { w: 1280, h: 800 }).x + card.w,
    ).toBeLessThanOrEqual(right.x);
  });

  it('stays on the screen', () => {
    const at = frontOf({ x: 0, y: 0, w: 40, h: 40 }, { x: -500, y: -500, w: 10, h: 10 }, card, { w: 390, h: 844 });
    expect(at.x).toBeGreaterThanOrEqual(0);
    expect(at.y).toBeGreaterThanOrEqual(0);
  });
});

describe('my drawn card shown large', () => {
  const caption = 40;
  it('takes the band above the piles on a phone, without reaching them', () => {
    const piles = { x: 118, y: 299, w: 153, h: 115 };
    const at = stageOf(
      {
        bar: { x: 12, y: 6, w: 366, h: 44 },
        piles,
        mine: { x: 12, y: 570, w: 366, h: 162 },
        screen: { w: 390, h: 844 },
      },
      caption,
    );
    expect(at.w).toBeGreaterThan(100);
    expect(at.y).toBeGreaterThan(50);
    expect(at.y + at.w * 1.4 + caption).toBeLessThanOrEqual(piles.y);
  });

  it('takes the felt beside the piles on a wide table, above my hand', () => {
    const piles = { x: 540, y: 224, w: 211, h: 157 };
    const mine = { x: 320, y: 424, w: 640, h: 249 };
    const at = stageOf({ bar: { x: 24, y: 6, w: 1232, h: 44 }, piles, mine, screen: { w: 1280, h: 800 } }, caption);
    expect(at.x + at.w).toBeLessThanOrEqual(piles.x);
    expect(at.y + at.w * 1.4 + caption).toBeLessThanOrEqual(mine.y);
    expect(at.w).toBeGreaterThan(150);
  });

  it('is one of two views', () => {
    expect(isDrawView('held')).toBe(true);
    expect(isDrawView('big')).toBe(true);
    expect(isDrawView('stage')).toBe(false);
  });
});

describe('which way the others’ cards face', () => {
  const middle = { x: 12, y: 149, w: 366, h: 415 };
  it('turns the cards of a seat across the table round, and those at the ends of the oval a quarter', () => {
    expect(facing({ x: 83, y: 74, w: 109, h: 69 }, middle)).toBe(180);
    expect(facing({ x: 198, y: 74, w: 109, h: 69 }, middle)).toBe(180);
    const wide = { x: 24, y: 224, w: 1232, h: 157 };
    expect(facing({ x: 132, y: 148, w: 206, h: 103 }, wide)).toBe(90);
    expect(facing({ x: 942, y: 148, w: 206, h: 103 }, wide)).toBe(270);
    // A seat below the middle would face it the way I do.
    expect(facing({ x: 150, y: 700, w: 90, h: 60 }, middle)).toBe(0);
  });
});
