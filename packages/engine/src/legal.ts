import type { Action, PlayerView, RuleSet, SlotRef } from '@tamalou/shared';
import type { GameState } from './state.ts';

// Every action a player may send, computed from their VIEW alone, so a bot and a UI use exactly what a human sees.
// A quick-discard claim is legal whatever the card turns out to be: a wrong one is a legal move with a penalty.

const combinations = (items: number[], k: number): number[][] => {
  if (k === 0) return [[]];
  const out: number[][] = [];
  items.forEach((x, i) => {
    for (const rest of combinations(items.slice(i + 1), k - 1)) out.push([x, ...rest]);
  });
  return out;
};

export function legalActions(view: PlayerView, rules: RuleSet): Action[] {
  const me = view.me;
  const mine = view.players.find((p) => p.id === me);
  if (!mine || mine.eliminated) return [];
  const out: Action[] = [];
  const filled = (playerId: string) =>
    (view.players.find((p) => p.id === playerId)?.slots ?? []).filter((sl) => sl.filled);
  const myFilled = filled(me).map((sl) => sl.slot);
  const opponents = view.players.filter((p) => p.id !== me && !p.eliminated);
  const opponentSlots: SlotRef[] = opponents.flatMap((p) =>
    p.slots.filter((sl) => sl.filled && !sl.locked).map((sl) => ({ player: p.id, slot: sl.slot })),
  );
  const ownSlots: SlotRef[] = myFilled.map((slot) => ({ player: me, slot }));

  if (view.phase === 'initialPeek') {
    if (view.ready.includes(me)) return [];
    if (view.myPeekSlots === null) {
      const all = mine.slots.map((sl) => sl.slot);
      for (const slots of combinations(all, rules.hand.initialPeek.count))
        out.push({ type: 'choosePeek', by: me, slots });
    } else {
      out.push({ type: 'ready', by: me });
    }
    return out;
  }

  if ((view.phase === 'play' || view.phase === 'roundEnding') && view.quickDiscardOpen && view.discardTop) {
    const expectTop = view.discardTop.id;
    for (const target of ownSlots) out.push({ type: 'quickDiscard', by: me, target, expectTop });
    if (rules.quickDiscard.allowOpponentCards) {
      for (const target of opponentSlots) {
        for (const give of myFilled) out.push({ type: 'quickDiscard', by: me, target, expectTop, give });
      }
    }
  }

  if (view.phase !== 'play' || view.current !== me) return out;
  const canCall = view.caller === null && view.myTurns >= rules.tamalou.minTurnsBeforeCall;

  switch (view.step) {
    case 'draw':
      if (view.deckSize > 0 || view.discardSize > 1) out.push({ type: 'draw', by: me, from: 'deck' });
      if (view.discardTop && (!rules.discardPickup.mustSwap || myFilled.length > 0)) {
        out.push({ type: 'draw', by: me, from: 'discard' });
      }
      if (rules.tamalou.timing === 'startOfTurn' && canCall) out.push({ type: 'callTamalou', by: me });
      break;
    case 'place':
      for (const slot of myFilled) out.push({ type: 'swap', by: me, slot });
      if (view.drawn && (view.drawn.from === 'deck' || !rules.discardPickup.mustSwap)) {
        out.push({ type: 'discardDrawn', by: me });
      }
      break;
    case 'power': {
      out.push({ type: 'skipPower', by: me });
      const power = view.pendingPower?.power;
      if (power === 'peekOwn') for (const t of ownSlots) out.push({ type: 'usePower', by: me, targets: [t] });
      if (power === 'peekOther') for (const t of opponentSlots) out.push({ type: 'usePower', by: me, targets: [t] });
      if (power === 'peekThenSwap') {
        for (const t of [...ownSlots, ...opponentSlots]) out.push({ type: 'usePower', by: me, targets: [t] });
      }
      if (power === 'blindSwap') {
        for (const a of ownSlots)
          for (const b of opponentSlots) out.push({ type: 'usePower', by: me, targets: [a, b] });
      }
      break;
    }
    case 'reveal': {
      const reveal = view.reveal;
      if (!reveal) break;
      if (reveal.power !== 'peekThenSwap') {
        out.push({ type: 'endReveal', by: me });
        break;
      }
      out.push({ type: 'queenDecide', by: me, swapWith: null });
      const others = reveal.target.player === me ? opponentSlots : ownSlots;
      for (const w of others) out.push({ type: 'queenDecide', by: me, swapWith: w });
      break;
    }
    case 'callDecision':
      out.push({ type: 'callTamalou', by: me });
      out.push({ type: 'passCall', by: me });
      break;
    default:
      break;
  }
  return out;
}

/** What the host owes the game, if anything: scoring a finished round, dealing the next one. */
export function hostAction(s: Pick<GameState, 'phase'>): Action | null {
  if (s.phase === 'roundEnding') return { type: 'endRound', by: 'host' };
  if (s.phase === 'roundOver') return { type: 'nextRound', by: 'host' };
  return null;
}
