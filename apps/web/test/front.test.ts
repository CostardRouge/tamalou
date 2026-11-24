import { describe, expect, it } from 'vitest';
import { facing, frontOf, isDrawView, liftOf, stageOf } from '../src/game/front.ts';

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

describe('how a drawn card in front of its player is raised', () => {
  const middle = { x: 12, y: 149, w: 366, h: 415 };
  const top = { x: 140, y: 20, w: 109, h: 69 };

  it('raises a hidden card on its player’s side, its hinge towards the middle', () => {
    const lift = liftOf(top, middle, false);
    expect(lift.origin).toMatch(/% 100\.0%$/);
    expect(lift.angle).toBeGreaterThan(0);
    // rotate3d(-1, 0, 0, +a) is rotateX(-a): the top edge (their side) comes towards me.
    expect(lift.axis.x).toBeLessThan(0);
  });

  it('leans a card everyone has seen the other way, its hinge on its player’s side', () => {
    const lift = liftOf(top, middle, true);
    expect(lift.origin).toMatch(/% 0\.0%$/);
    expect(lift.angle).toBeLessThan(0);
    expect(lift.axis).toEqual(liftOf(top, middle, false).axis);
  });

  it('turns about an upright hinge for a seat at the end of a wide table', () => {
    const wide = { x: 24, y: 300, w: 1232, h: 157 };
    const left = { x: 24, y: 330, w: 120, h: 100 };
    expect(liftOf(left, wide, false).origin).toMatch(/^100\.0% /);
    expect(liftOf(left, wide, true).origin).toMatch(/^0\.0% /);
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
  it('turns the cards of every seat beyond the middle round, never a quarter', () => {
    expect(facing({ x: 83, y: 74, w: 109, h: 69 }, middle)).toBe(180);
    expect(facing({ x: 198, y: 74, w: 109, h: 69 }, middle)).toBe(180);
    const wide = { x: 24, y: 224, w: 1232, h: 157 };
    expect(facing({ x: 132, y: 148, w: 206, h: 103 }, wide)).toBe(180);
    expect(facing({ x: 942, y: 148, w: 206, h: 103 }, wide)).toBe(180);
    // A seat below the middle would face it the way I do.
    expect(facing({ x: 150, y: 700, w: 90, h: 60 }, middle)).toBe(0);
  });
});
