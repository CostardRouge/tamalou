import { legalActions } from '@tamalou/engine';
import type { Action, PlayerId, PlayerView, RuleSet, SlotRef } from '@tamalou/shared';

// What the player can touch right now, and what each touch sends. Everything is derived from legalActions(view): the UI
// offers exactly the moves the engine would accept, and a move it does not list cannot be made from the screen.
// Local selection states cover the moves that take two touches (a blind swap, an opponent's card in a quick discard,
// the initial peek in choose mode).

export type Pending =
  | { kind: 'none' }
  | { kind: 'quick' }
  | { kind: 'quickGive'; target: SlotRef }
  | { kind: 'blindOwn'; own: number }
  | { kind: 'choosePeek'; slots: number[] };

export const NONE: Pending = { kind: 'none' };

export interface SlotAction {
  /** What the touch does: send an action, or move to a next selection state. */
  send?: Action;
  next?: Pending;
}

export interface Interaction {
  legal: Action[];
  /** The action a touch on this slot triggers, if any. */
  slot(ref: SlotRef): SlotAction | null;
  /** Slots shown as picked in the current selection. */
  selected(ref: SlotRef): boolean;
  find<T extends Action['type']>(
    type: T,
    test?: (a: Extract<Action, { type: T }>) => boolean,
  ): Extract<Action, { type: T }> | undefined;
  canQuick: boolean;
}

const same = (a: SlotRef, b: SlotRef) => a.player === b.player && a.slot === b.slot;

export function interaction(view: PlayerView, rules: RuleSet, pending: Pending): Interaction {
  const legal = legalActions(view, rules);
  const me: PlayerId = view.me;
  const find = <T extends Action['type']>(type: T, test: (a: Extract<Action, { type: T }>) => boolean = () => true) =>
    legal.find((a): a is Extract<Action, { type: T }> => a.type === type && test(a as Extract<Action, { type: T }>));
  const quick = legal.filter((a): a is Extract<Action, { type: 'quickDiscard' }> => a.type === 'quickDiscard');

  const slot = (ref: SlotRef): SlotAction | null => {
    switch (pending.kind) {
      case 'quick': {
        if (ref.player === me) {
          const a = quick.find((q) => same(q.target, ref) && q.give === undefined);
          return a ? { send: a } : null;
        }
        return quick.some((q) => same(q.target, ref)) ? { next: { kind: 'quickGive', target: ref } } : null;
      }
      case 'quickGive': {
        if (ref.player !== me) return null;
        const a = quick.find((q) => same(q.target, pending.target) && q.give === ref.slot);
        return a ? { send: a } : null;
      }
      case 'choosePeek': {
        if (ref.player !== me) return null;
        const picked = pending.slots.includes(ref.slot);
        const slots = picked ? pending.slots.filter((s) => s !== ref.slot) : [...pending.slots, ref.slot];
        if (slots.length > rules.hand.initialPeek.count) return null;
        return { next: { kind: 'choosePeek', slots } };
      }
      case 'blindOwn': {
        const a = find('usePower', (u) => u.targets[0]?.slot === pending.own && same(u.targets[1] as SlotRef, ref));
        if (a) return { send: a };
        // A touch on another of my cards changes my pick.
        return ref.player === me && find('usePower', (u) => u.targets[0]?.slot === ref.slot)
          ? { next: { kind: 'blindOwn', own: ref.slot } }
          : null;
      }
      default:
        break;
    }
    if (view.phase === 'initialPeek' && view.myPeekSlots === null && ref.player === me && find('choosePeek')) {
      return rules.hand.initialPeek.count > 0 ? { next: { kind: 'choosePeek', slots: [ref.slot] } } : null;
    }
    const swap = find('swap', (a) => ref.player === me && a.slot === ref.slot);
    if (swap) return { send: swap };
    if (view.step === 'power' && view.pendingPower?.power === 'blindSwap') {
      return ref.player === me && find('usePower', (u) => u.targets[0]?.slot === ref.slot)
        ? { next: { kind: 'blindOwn', own: ref.slot } }
        : null;
    }
    const use = find('usePower', (u) => u.targets.length === 1 && same(u.targets[0] as SlotRef, ref));
    if (use) return { send: use };
    const queen = find('queenDecide', (q) => q.swapWith !== null && same(q.swapWith, ref));
    if (queen) return { send: queen };
    return null;
  };

  const selected = (ref: SlotRef): boolean => {
    if (pending.kind === 'blindOwn') return ref.player === me && ref.slot === pending.own;
    if (pending.kind === 'quickGive') return same(ref, pending.target);
    if (pending.kind === 'choosePeek') return ref.player === me && pending.slots.includes(ref.slot);
    return false;
  };

  return { legal, slot, selected, find, canQuick: quick.length > 0 };
}
