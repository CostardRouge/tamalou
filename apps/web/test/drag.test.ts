import { apply, createGame, type GameState, viewFor } from '@tamalou/engine';
import { type Action, parseRules } from '@tamalou/shared';
import { describe, expect, it } from 'vitest';
import { type Box, dropsFor, MY_ZONE, resolveDrop } from '../src/game/drag.ts';
import { interaction, NONE } from '../src/game/interaction.ts';

const rules = parseRules({ hand: { initialPeek: { count: 0 } } });
const start = () =>
  createGame({
    seed: 11,
    players: [
      { id: 'me', name: 'Moi' },
      { id: 'bot', name: 'Ada' },
    ],
    rules,
  }).state;
const act = (s: GameState, a: Action) => {
  const r = apply(s, a, rules);
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const uiOf = (s: GameState, who = 'me') => {
  const view = viewFor(s, who, rules);
  return { view, ui: interaction(view, rules, NONE) };
};

describe('what a card carried by hand may land on', () => {
  it('draws from the deck onto one of my cards, then swaps it there', () => {
    const { view, ui } = uiOf(start());
    const drops = dropsFor({ kind: 'deck' }, ui, view);
    const onSecond = drops.find((d) => d.place === 'slot:me:1');
    expect(onSecond?.send).toEqual({ type: 'draw', by: 'me', from: 'deck' });
    expect(onSecond?.followUp).toEqual({ type: 'swap', by: 'me', slot: 1 });
    expect(drops.some((d) => d.place === MY_ZONE && !d.followUp)).toBe(true);
  });

  it('swaps or discards the drawn card, and offers nothing an opponent could do', () => {
    const { view, ui } = uiOf(act(start(), { type: 'draw', by: 'me', from: 'deck' }));
    const drops = dropsFor({ kind: 'drawn' }, ui, view);
    expect(drops.map((d) => d.place).sort()).toEqual(['discard', 'slot:me:0', 'slot:me:1', 'slot:me:2', 'slot:me:3']);
    expect(dropsFor({ kind: 'deck' }, ui, view)).toEqual([]);
    const other = uiOf(act(start(), { type: 'draw', by: 'me', from: 'deck' }), 'bot');
    expect(dropsFor({ kind: 'drawn' }, other.ui, other.view)).toEqual([]);
  });

  it('throws one of my cards on the open discard as a quick discard', () => {
    // The round opens with a card face up on the discard: the window is open for the others.
    const { view, ui } = uiOf(start(), 'bot');
    const drops = dropsFor({ kind: 'slot', ref: { player: 'bot', slot: 2 } }, ui, view);
    expect(drops).toHaveLength(1);
    expect(drops[0]?.place).toBe('discard');
    expect(drops[0]?.send).toMatchObject({ type: 'quickDiscard', target: { player: 'bot', slot: 2 } });
  });
});

describe('where a release lands', () => {
  const boxes = new Map<string, Box>([
    ['slot:me:0', { x: 100, y: 400, w: 80, h: 112 }],
    ['slot:me:1', { x: 190, y: 400, w: 80, h: 112 }],
    ['discard', { x: 150, y: 250, w: 70, h: 98 }],
    [MY_ZONE, { x: 20, y: 380, w: 350, h: 300 }],
  ]);
  const drops = [
    { place: 'slot:me:0', send: { type: 'swap', by: 'me', slot: 0 }, label: { key: 'dropSwap' } },
    { place: 'slot:me:1', send: { type: 'swap', by: 'me', slot: 1 }, label: { key: 'dropSwap' } },
    { place: 'discard', send: { type: 'discardDrawn', by: 'me' }, label: { key: 'dropDiscard' } },
  ] as const;
  const still = { x: 0, y: 0 };

  it('takes the card under the finger', () => {
    expect(resolveDrop(drops, boxes, { x: 140, y: 450 }, still).map((d) => d.place)).toEqual(['slot:me:0']);
  });

  it('takes the card whose middle is nearest where two cards overlap', () => {
    const overlapping = new Map(boxes);
    overlapping.set('slot:me:1', { x: 150, y: 400, w: 80, h: 112 });
    expect(resolveDrop(drops, overlapping, { x: 168, y: 450 }, still).map((d) => d.place)).toEqual(['slot:me:1']);
    expect(resolveDrop(drops, overlapping, { x: 155, y: 450 }, still).map((d) => d.place)).toEqual(['slot:me:0']);
  });

  it('asks between two cards when the finger is between them', () => {
    expect(resolveDrop(drops, boxes, { x: 185, y: 450 }, still).map((d) => d.place)).toEqual([
      'slot:me:0',
      'slot:me:1',
    ]);
  });

  it('counts a quick flick towards the discard as a drop on it, and a drop on nothing as nothing', () => {
    expect(resolveDrop(drops, boxes, { x: 185, y: 600 }, { x: -50, y: -1500 }).map((d) => d.place)).toEqual([
      'discard',
    ]);
    expect(resolveDrop(drops, boxes, { x: 330, y: 120 }, still)).toEqual([]);
  });
});
