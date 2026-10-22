import { describe, expect, it } from 'vitest';
import { curve, HAND_LAYOUTS, handFrame, isHandLayout, opponentLayout, slotStyle } from '../src/game/hand.ts';

describe('hand layouts', () => {
  it('lists the six layouts of the canvas and recognises only them', () => {
    expect(HAND_LAYOUTS).toEqual(['grid', 'row', 'flat', 'arc', 'fan', 'carousel']);
    expect(isHandLayout('fan')).toBe(true);
    expect(isHandLayout('spiral')).toBe(false);
    expect(isHandLayout(undefined)).toBe(false);
  });

  it('gives opponents my hand’s family, a row for what a seat cannot hold, the grid when they do not follow', () => {
    expect(opponentLayout('arc', true)).toBe('arc');
    expect(opponentLayout('fan', true)).toBe('fan');
    expect(opponentLayout('row', true)).toBe('row');
    expect(opponentLayout('flat', true)).toBe('row');
    expect(opponentLayout('carousel', true)).toBe('row');
    expect(opponentLayout('fan', false)).toBe('grid');
  });

  it('keeps an arc of four apart and closes it up as penalty cards arrive, within a fixed width', () => {
    const four = curve('arc', 4);
    const eight = curve('arc', 8);
    // Centres 1.1 widths apart: the cards do not touch.
    expect(Math.sin(four.step * (Math.PI / 180)) * (four.pivot + 0.7)).toBeCloseTo(1.1, 2);
    expect(eight.step).toBeLessThan(four.step);
    expect(eight.span).toBeLessThan(four.span + 0.2);
    expect(four.sag).toBeGreaterThan(0);
  });

  it('opens a fan 11° a card, and never more than 46° end to end', () => {
    expect(curve('fan', 4).step).toBe(11);
    expect(curve('fan', 8).step * 7).toBeCloseTo(46, 2);
    expect(curve('fan', 1)).toMatchObject({ step: 11, span: 1, sag: 0 });
  });

  it('draws a tighter arc for a small seat', () => {
    expect(curve('arc', 4, true).span).toBeLessThan(curve('arc', 4).span);
  });

  it('writes the classes and properties app.css reads', () => {
    expect(handFrame('grid', 4, 2)).toEqual({ className: 'grid hand lay-grid', style: { '--n': 4, '--cols': 2 } });
    expect(handFrame('row', 5, 2).className).toBe('hand lay-row');
    const fan = handFrame('fan', 4, 2, true);
    expect(fan.className).toBe('hand lay-fan lay-across');
    expect(fan.style).toMatchObject({ '--step': 11, '--pivot': 3 });
    expect(handFrame('row', 4, 2, true).className).toBe('hand lay-row');
    expect(slotStyle(0, 4)).toEqual({ '--k': -1.5 });
    expect(slotStyle(3, 4)).toEqual({ '--k': 1.5 });
  });
});
