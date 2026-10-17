import type { Action, PlayerView, SlotRef } from '@tamalou/shared';
import type { Key } from '../i18n/index.ts';
import { type Place, slotPlace } from './flights.ts';
import type { Interaction } from './interaction.ts';

// Everything by hand (the owner's design D, "physique souple", and design C of the quick discard, 2026-10-17): what
// a card picked up can be dropped on, and what each drop does. Derived from the legal moves like every touch
// (interaction.ts): a drop the engine would refuse is never offered. Taps and buttons keep working; dragging is a
// second way to play the same moves.

export type DragSource = { kind: 'deck' } | { kind: 'discard' } | { kind: 'drawn' } | { kind: 'slot'; ref: SlotRef };

export interface Drop {
  /** Where it lands: a card's place, or `zone:mine` (anywhere in my grid's box). */
  place: Place;
  send: Action;
  /** Sent once the first move is through: drawing onto one of my cards swaps it there. */
  followUp?: Action;
  /** What the question says when a drop could mean two things (`player` is named by the table). */
  label: { key: Key; n?: number; player?: string };
}

export const MY_ZONE: Place = 'zone:mine';

export function dropsFor(source: DragSource, ui: Interaction, view: PlayerView): Drop[] {
  const me = view.me;
  const mine = view.players.find((p) => p.id === me);
  const mySlots = mine ? mine.slots.filter((s) => s.filled).map((s) => s.slot) : [];
  const swapAfter = (send: Action, from: 'deck' | 'discard'): Drop[] => [
    ...mySlots.map(
      (slot): Drop => ({
        place: slotPlace({ player: me, slot }),
        send,
        followUp: { type: 'swap', by: me, slot },
        label: { key: from === 'deck' ? 'dropDrawSwap' : 'dropTakeSwap', n: slot + 1 },
      }),
    ),
    { place: MY_ZONE, send, label: { key: from === 'deck' ? 'dropDraw' : 'dropTake' } },
  ];
  switch (source.kind) {
    case 'deck': {
      const draw = ui.find('draw', (a) => a.from === 'deck');
      return draw ? swapAfter(draw, 'deck') : [];
    }
    case 'discard': {
      const take = ui.find('draw', (a) => a.from === 'discard');
      return take ? swapAfter(take, 'discard') : [];
    }
    case 'drawn': {
      const out: Drop[] = [];
      for (const slot of mySlots) {
        const swap = ui.find('swap', (a) => a.slot === slot);
        if (swap)
          out.push({ place: slotPlace({ player: me, slot }), send: swap, label: { key: 'dropSwap', n: slot + 1 } });
      }
      const discard = ui.find('discardDrawn');
      if (discard) out.push({ place: 'discard', send: discard, label: { key: 'dropDiscard' } });
      return out;
    }
    case 'slot': {
      const { ref } = source;
      if (ref.player !== me) return [];
      const out: Drop[] = [];
      const quick = ui.legal.find(
        (a) =>
          a.type === 'quickDiscard' && a.target.player === me && a.target.slot === ref.slot && a.give === undefined,
      );
      if (quick) out.push({ place: 'discard', send: quick, label: { key: 'dropQuick', n: ref.slot + 1 } });
      for (const a of ui.legal) {
        if (a.type !== 'usePower') continue;
        const [own, other] = a.targets;
        if (!own || !other || own.player !== me || own.slot !== ref.slot) continue;
        out.push({
          place: slotPlace(other),
          send: a,
          label: { key: 'dropBlind', n: other.slot + 1, player: other.player },
        });
      }
      return out;
    }
  }
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const inside = (b: Box, x: number, y: number, pad: number) =>
  x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad;

/**
 * The drop a release means: the card under the finger (a card wins over my grid's box); when the finger is between
 * two cards, every card it is close to, so the table can ask; a quick flick towards the discard counts as a drop on
 * it ("un lancer rapide suffit").
 */
export function resolveDrop(
  drops: readonly Drop[],
  boxes: ReadonlyMap<Place, Box>,
  point: { x: number; y: number },
  velocity: { x: number; y: number },
): Drop[] {
  const hit = (pad: number) =>
    drops.filter(
      (d) => d.place !== MY_ZONE && boxes.get(d.place) && inside(boxes.get(d.place) as Box, point.x, point.y, pad),
    );
  const direct = hit(0);
  if (direct.length > 0) return direct.slice(0, 1);
  const near = hit(22);
  if (near.length > 0) return near;
  const toDiscard = drops.find((d) => d.place === 'discard');
  const discard = boxes.get('discard');
  const speed = Math.hypot(velocity.x, velocity.y);
  if (toDiscard && discard && speed > 900) {
    const dx = discard.x + discard.w / 2 - point.x;
    const dy = discard.y + discard.h / 2 - point.y;
    const cos = (dx * velocity.x + dy * velocity.y) / (Math.hypot(dx, dy) * speed || 1);
    if (cos > 0.9) return [toDiscard];
  }
  const zone = drops.find((d) => d.place === MY_ZONE);
  const zoneBox = boxes.get(MY_ZONE);
  if (zone && zoneBox && inside(zoneBox, point.x, point.y, 0)) return [zone];
  return [];
}
