import { parseRules } from '@tamalou/shared';
import { describe, expect, it } from 'vitest';
import { apply, createGame, legalActions, viewFor } from '../src/index.ts';
import { act, handOf, label, newGame, play, refuse, rig, rules, top } from './helpers.ts';

const base = rules();

describe('setup', () => {
  it('deals four cards each, flips one, and starts with the first seat', () => {
    const r = parseRules();
    const { state, events } = newGame(r, 3);
    expect(Object.values(state.hands).map((h) => h.length)).toEqual([4, 4, 4]);
    expect(state.discard).toHaveLength(1);
    expect(state.deck).toHaveLength(52 - 12 - 1);
    expect(state.phase).toBe('initialPeek');
    // Each player is shown their bottom two cards, privately.
    const peeks = events.filter((e) => e.type === 'initialPeek');
    expect(peeks.map((e) => e.to)).toEqual(['a', 'b', 'c']);
    expect(peeks[0]?.cards.map((c) => c.slot)).toEqual([2, 3]);
  });

  it('starts play once every player is ready, and only shows the peeked cards until then', () => {
    const r = parseRules();
    const { state } = newGame(r, 2);
    const v = viewFor(state, 'a', r);
    expect(v.players[0]?.slots.map((s) => s.card !== null)).toEqual([false, false, true, true]);
    expect(v.players[1]?.slots.every((s) => s.card === null)).toBe(true);
    const s1 = act(state, { type: 'ready', by: 'a' }, r).state;
    expect(s1.phase).toBe('initialPeek');
    expect(viewFor(s1, 'a', r).players[0]?.slots.every((s) => s.card === null)).toBe(true);
    const s2 = act(s1, { type: 'ready', by: 'b' }, r).state;
    expect(s2.phase).toBe('play');
    expect(s2.current).toBe('a');
    expect(refuse(s2, { type: 'ready', by: 'a' }, r)).toBe('wrongPhase');
  });

  it('lets each player choose their peek in choose mode', () => {
    const r = parseRules({ hand: { initialPeek: { mode: 'choose', count: 1 } } });
    const { state } = newGame(r, 2);
    expect(refuse(state, { type: 'ready', by: 'a' }, r)).toBe('notChosen');
    expect(refuse(state, { type: 'choosePeek', by: 'a', slots: [0, 1] }, r)).toBe('badSlot');
    const { state: s1, events } = act(state, { type: 'choosePeek', by: 'a', slots: [1] }, r);
    expect(events).toMatchObject([{ type: 'initialPeek', to: 'a', cards: [{ slot: 1 }] }]);
    expect(refuse(s1, { type: 'choosePeek', by: 'a', slots: [0] }, r)).toBe('alreadyChosen');
  });

  it('refuses a table that cannot be dealt', () => {
    expect(() => newGame(base, 1)).toThrow();
    expect(() =>
      createGame({
        seed: 1,
        players: [
          { id: 'a', name: 'A' },
          { id: 'a', name: 'B' },
        ],
        rules: base,
      }),
    ).toThrow('duplicate');
    // The schema's limits (6 players, 8 cards) always fit one deck: the guard in createGame is defensive.
    expect(() => newGame(rules({ hand: { size: 8 } }), 6)).not.toThrow();
  });

  it('adds jokers and a second deck on request', () => {
    expect(newGame(rules({ deck: { jokers: true } })).state.cards).toHaveLength(54);
    expect(newGame(rules({ deck: { count: 2, jokers: true } })).state.cards).toHaveLength(108);
  });
});

describe('a turn', () => {
  const start = () =>
    rig(newGame(base).state, { hands: { a: ['2H', '3H', '4H', '5H'] }, discard: ['9C'], deck: ['6S'] });

  it('draws from the pile, privately, then swaps: the old card goes face up on the discard', () => {
    const s = start();
    const { state: s1, events } = act(s, { type: 'draw', by: 'a', from: 'deck' }, base);
    expect(events).toMatchObject([
      { type: 'drew', player: 'a', from: 'deck' },
      { type: 'drewCard', to: 'a' },
    ]);
    expect(events[0]).not.toHaveProperty('card');
    expect(viewFor(s1, 'b', base).drawn).toEqual({ from: 'deck', card: null });
    expect(viewFor(s1, 'a', base).drawn?.card?.rank).toBe('6');
    const { state: s2 } = act(s1, { type: 'swap', by: 'a', slot: 1 }, base);
    expect(handOf(s2, 'a')).toEqual(['2H', '6S', '4H', '5H']);
    expect(label(s2, top(s2))).toBe('3H');
    expect(s2.current).toBe('b');
  });

  it('takes the discard publicly, and must swap it in', () => {
    const s = start();
    const { state: s1, events } = act(s, { type: 'draw', by: 'a', from: 'discard' }, base);
    expect(events[0]).toMatchObject({ type: 'drew', from: 'discard', card: { rank: '9' } });
    expect(refuse(s1, { type: 'discardDrawn', by: 'a' }, base)).toBe('mustSwap');
    const loose = rules({ discardPickup: { mustSwap: false } });
    expect(apply(s1, { type: 'discardDrawn', by: 'a' }, loose).ok).toBe(true);
  });

  it('refuses moves out of turn or out of step', () => {
    const s = start();
    expect(refuse(s, { type: 'draw', by: 'b', from: 'deck' }, base)).toBe('notYourTurn');
    expect(refuse(s, { type: 'swap', by: 'a', slot: 0 }, base)).toBe('wrongStep');
    expect(refuse(s, { type: 'draw', by: 'z', from: 'deck' }, base)).toBe('notAPlayer');
    const s1 = act(s, { type: 'draw', by: 'a', from: 'deck' }, base).state;
    expect(refuse(s1, { type: 'swap', by: 'a', slot: 9 }, base)).toBe('badSlot');
    expect(refuse(s1, { type: 'draw', by: 'a', from: 'deck' }, base)).toBe('wrongStep');
  });

  it('rebuilds an empty pile from the discard, keeping its top', () => {
    let s = start();
    s = { ...s, deck: [], discard: [...s.deck.slice(0, 5), top(s)] };
    const keep = top(s);
    const { state: s1, events } = act(s, { type: 'draw', by: 'a', from: 'deck' }, base);
    expect(events[0]).toEqual({ type: 'deckReshuffled', size: 5 });
    expect(s1.discard).toEqual([keep]);
    expect(s1.deck).toHaveLength(4);
  });

  it('refuses to draw when the pile cannot be rebuilt', () => {
    let s = start();
    s = { ...s, deck: [], discard: [top(s)] };
    expect(refuse(s, { type: 'draw', by: 'a', from: 'deck' }, base)).toBe('deckEmpty');
    expect(legalActions(viewFor(s, 'a', base), base).some((x) => x.type === 'draw' && x.from === 'deck')).toBe(false);
  });
});

describe('powers', () => {
  const withDrawn = (card: string, r = base) => {
    const s = rig(newGame(r, 3).state, {
      hands: { a: ['2H', '3H', '4H', '5H'], b: ['2S', '3S', '4S', '5S'], c: ['2D', '3D', '4D', '5D'] },
      deck: [card],
    });
    return act(s, { type: 'draw', by: 'a', from: 'deck' }, r).state;
  };

  it('offers a power only for a card from the pile discarded directly', () => {
    const s = withDrawn('7C');
    const { state: viaSwap } = act(s, { type: 'swap', by: 'a', slot: 0 }, base);
    expect(viaSwap.step).toBe('draw');
    expect(viaSwap.current).toBe('b');
    const { state: direct, events } = act(s, { type: 'discardDrawn', by: 'a' }, base);
    expect(direct.step).toBe('power');
    expect(events.at(-1)).toEqual({ type: 'powerOffered', player: 'a', power: 'peekOwn' });
    // The power comes first: no quick discard on the 7 before it resolves (ADR-0006).
    expect(viewFor(direct, 'b', base).quickDiscardOpen).toBe(false);
  });

  it('gives a King no power', () => {
    const { state } = act(withDrawn('KC'), { type: 'discardDrawn', by: 'a' }, base);
    expect(state.current).toBe('b');
  });

  it('can be skipped', () => {
    const s = act(withDrawn('8C'), { type: 'discardDrawn', by: 'a' }, base).state;
    const { state, events } = act(s, { type: 'skipPower', by: 'a' }, base);
    expect(events[0]).toEqual({ type: 'powerSkipped', player: 'a', power: 'peekOwn' });
    expect(state.current).toBe('b');
  });

  it('7/8 peek at one of my own cards, shown to me alone', () => {
    const s = act(withDrawn('7C'), { type: 'discardDrawn', by: 'a' }, base).state;
    expect(refuse(s, { type: 'usePower', by: 'a', targets: [{ player: 'b', slot: 0 }] }, base)).toBe('badTargets');
    const { state, events } = act(s, { type: 'usePower', by: 'a', targets: [{ player: 'a', slot: 2 }] }, base);
    expect(events.find((e) => e.type === 'peeked')).toMatchObject({ to: 'a', card: { rank: '4', suit: 'H' } });
    expect(events.find((e) => e.type === 'powerUsed')).toMatchObject({ targets: [{ player: 'a', slot: 2 }] });
    expect(viewFor(state, 'a', base).reveal?.card?.rank).toBe('4');
    expect(viewFor(state, 'a', base).players[0]?.slots[2]?.card?.rank).toBe('4');
    expect(viewFor(state, 'b', base).reveal).toMatchObject({ player: 'a', card: null });
    expect(viewFor(state, 'b', base).players[0]?.slots[2]?.card).toBeNull();
    const done = act(state, { type: 'endReveal', by: 'a' }, base).state;
    expect(done.current).toBe('b');
    expect(viewFor(done, 'a', base).players[0]?.slots[2]?.card).toBeNull();
  });

  it("9/10 peek at an opponent's card", () => {
    const s = act(withDrawn('10C'), { type: 'discardDrawn', by: 'a' }, base).state;
    expect(refuse(s, { type: 'usePower', by: 'a', targets: [{ player: 'a', slot: 0 }] }, base)).toBe('badTargets');
    const { events } = act(s, { type: 'usePower', by: 'a', targets: [{ player: 'c', slot: 3 }] }, base);
    expect(events.find((e) => e.type === 'peeked')).toMatchObject({ card: { rank: '5', suit: 'D' } });
  });

  it("the Jack swaps one of mine with an opponent's, blind", () => {
    const s = act(withDrawn('JC'), { type: 'discardDrawn', by: 'a' }, base).state;
    const { state, events } = act(
      s,
      {
        type: 'usePower',
        by: 'a',
        targets: [
          { player: 'a', slot: 0 },
          { player: 'b', slot: 3 },
        ],
      },
      base,
    );
    expect(handOf(state, 'a')[0]).toBe('5S');
    expect(handOf(state, 'b')[3]).toBe('2H');
    expect(events.some((e) => e.type === 'peeked')).toBe(false);
    expect(state.current).toBe('b');
  });

  it('the Queen looks, then swaps across or keeps', () => {
    const s = act(withDrawn('QC'), { type: 'discardDrawn', by: 'a' }, base).state;
    const looked = act(s, { type: 'usePower', by: 'a', targets: [{ player: 'b', slot: 1 }] }, base).state;
    expect(refuse(looked, { type: 'endReveal', by: 'a' }, base)).toBe('wrongStep');
    // The swap goes across: the looked-at card is b's, so it is swapped with one of a's.
    expect(refuse(looked, { type: 'queenDecide', by: 'a', swapWith: { player: 'c', slot: 0 } }, base)).toBe(
      'badTargets',
    );
    const swapped = act(looked, { type: 'queenDecide', by: 'a', swapWith: { player: 'a', slot: 3 } }, base).state;
    expect(handOf(swapped, 'a')[3]).toBe('3S');
    expect(handOf(swapped, 'b')[1]).toBe('5H');
    const kept = act(looked, { type: 'queenDecide', by: 'a', swapWith: null }, base).state;
    expect(handOf(kept, 'b')[1]).toBe('3S');
    expect(kept.current).toBe('b');
  });

  it('reads the power table from the rules', () => {
    const r = rules({ powers: { byRank: { K: 'peekOther', '7': 'none' } } });
    expect(act(withDrawn('KC', r), { type: 'discardDrawn', by: 'a' }, r).state.pendingPower?.power).toBe('peekOther');
    expect(act(withDrawn('7C', r), { type: 'discardDrawn', by: 'a' }, r).state.step).toBe('draw');
  });

  it('also fires from the discard when activation is anyPile', () => {
    const r = rules({ powers: { activation: 'anyPile' }, discardPickup: { mustSwap: false } });
    let s = rig(newGame(r).state, { discard: ['9C'] });
    s = act(s, { type: 'draw', by: 'a', from: 'discard' }, r).state;
    expect(act(s, { type: 'discardDrawn', by: 'a' }, r).state.step).toBe('power');
    expect(act(s, { type: 'discardDrawn', by: 'a' }, rules({ discardPickup: { mustSwap: false } })).state.step).toBe(
      'draw',
    );
  });
});

describe('quick discard', () => {
  const open = (r = base) =>
    rig(newGame(r, 3).state, {
      hands: { a: ['2H', '3H', '4H', '5H'], b: ['9S', '3S', '4S', '5S'], c: ['2D', '3D', '4D', '5D'] },
      discard: ['9C'],
      deck: ['KS', 'QS'],
    });

  it('lets anyone, out of turn, lay a card of the same rank', () => {
    const s = open();
    const { state, events } = act(
      s,
      { type: 'quickDiscard', by: 'b', target: { player: 'b', slot: 0 }, expectTop: top(s) },
      base,
    );
    expect(events[0]).toMatchObject({ type: 'quickDiscard', player: 'b', card: { rank: '9' } });
    expect(state.hands.b?.[0]).toBeNull();
    expect(label(state, top(state))).toBe('9S');
    const v = viewFor(state, 'a', base);
    expect(v.players[1]?.slots[0]).toMatchObject({ filled: false, card: null });
  });

  it('penalises a wrong claim: the card goes back, a penalty card opens a new slot, unseen', () => {
    const s = open();
    const { state, events } = act(
      s,
      { type: 'quickDiscard', by: 'c', target: { player: 'c', slot: 0 }, expectTop: top(s) },
      base,
    );
    expect(events[0]).toMatchObject({ type: 'quickDiscardFailed', card: { rank: '2', suit: 'D' }, penalty: [4] });
    expect(handOf(state, 'c')).toEqual(['2D', '3D', '4D', '5D', 'QS']);
    expect(viewFor(state, 'c', base).players[2]?.slots[4]).toMatchObject({ filled: true, card: null });
    expect(events.some((e) => e.type === 'drewCard')).toBe(false);
    const harsh = rules({ quickDiscard: { penaltyCards: 2 } });
    const two = act(
      open(harsh),
      { type: 'quickDiscard', by: 'c', target: { player: 'c', slot: 0 }, expectTop: top(s) },
      harsh,
    );
    expect(two.state.hands.c).toHaveLength(6);
  });

  it('cancels, without penalty, a claim aimed at a top card that has changed', () => {
    const s = open();
    const first = act(
      s,
      { type: 'quickDiscard', by: 'b', target: { player: 'b', slot: 0 }, expectTop: top(s) },
      base,
    ).state;
    expect(
      refuse(first, { type: 'quickDiscard', by: 'c', target: { player: 'c', slot: 0 }, expectTop: top(s) }, base),
    ).toBe('staleTop');
  });

  it('closes when the next player draws, and reopens when a card lands', () => {
    const s = open();
    const drew = act(s, { type: 'draw', by: 'a', from: 'deck' }, base).state;
    expect(
      refuse(drew, { type: 'quickDiscard', by: 'b', target: { player: 'b', slot: 0 }, expectTop: top(drew) }, base),
    ).toBe('windowClosed');
    const swapped = act(drew, { type: 'swap', by: 'a', slot: 0 }, base).state;
    expect(viewFor(swapped, 'c', base).quickDiscardOpen).toBe(true);
    // The 2 of hearts is now on top; c holds the 2 of diamonds.
    expect(
      apply(swapped, { type: 'quickDiscard', by: 'c', target: { player: 'c', slot: 0 }, expectTop: top(swapped) }, base)
        .ok,
    ).toBe(true);
  });

  it("claims an opponent's card only when allowed, handing them one of mine", () => {
    const s = open();
    const claim = {
      type: 'quickDiscard',
      by: 'a',
      target: { player: 'b', slot: 0 },
      expectTop: top(s),
      give: 3,
    } as const;
    expect(refuse(s, claim, base)).toBe('opponentCardsDisabled');
    const r = rules({ quickDiscard: { allowOpponentCards: true } });
    expect(refuse(s, { ...claim, give: undefined }, r)).toBe('badGive');
    const { state } = act(s, claim, r);
    expect(handOf(state, 'b')[0]).toBe('5H');
    expect(handOf(state, 'a')[3]).toBeNull();
  });

  it('can be turned off', () => {
    const r = rules({ quickDiscard: { enabled: false } });
    const s = open(r);
    expect(refuse(s, { type: 'quickDiscard', by: 'b', target: { player: 'b', slot: 0 }, expectTop: top(s) }, r)).toBe(
      'quickDiscardDisabled',
    );
    expect(viewFor(s, 'b', r).quickDiscardOpen).toBe(false);
  });

  it('skips the penalty cards the pile cannot provide', () => {
    let s = open();
    s = { ...s, deck: [], discard: [top(s)] };
    const { state, events } = act(
      s,
      { type: 'quickDiscard', by: 'c', target: { player: 'c', slot: 0 }, expectTop: top(s) },
      base,
    );
    expect(events.at(-1)).toEqual({ type: 'penaltySkipped', player: 'c', missing: 1 });
    expect(state.hands.c).toHaveLength(4);
  });
});

describe('Tamalou and scoring', () => {
  const table = (r = base) =>
    rig(newGame(r, 3).state, {
      // a: 1+2+3+0 = 6 (red king); b: 10+10+10+10 = 40; c: 1+1+1+4 = 7
      hands: { a: ['AH', '2H', '3H', 'KD'], b: ['10S', 'JS', 'QS', 'KS'], c: ['AS', 'AC', 'AD', '4C'] },
      discard: ['9C'],
      deck: ['8C', '8D', '8S', '8H'],
    });
  // Each remaining player draws and swaps in slot 0... no: discards the 8 drawn and skips its power.
  const passTurn = (by: string) => [
    { type: 'draw', by, from: 'deck' } as const,
    { type: 'discardDrawn', by } as const,
    { type: 'skipPower', by } as const,
  ];

  it('replaces the caller’s turn, gives every other player one last turn, then waits for the host', () => {
    const s = table();
    const { state, events } = act(s, { type: 'callTamalou', by: 'a' }, base);
    expect(events.slice(0, 2)).toEqual([
      { type: 'tamalouCalled', player: 'a' },
      { type: 'lastTurns', players: ['b', 'c'] },
    ]);
    expect(state.current).toBe('b');
    const end = play(state, [...passTurn('b'), ...passTurn('c')], base).state;
    expect(end.phase).toBe('roundEnding');
    expect(viewFor(end, 'b', base).quickDiscardOpen).toBe(true);
    const { state: over, events: ev } = act(end, { type: 'endRound', by: 'host' }, base);
    expect(over.phase).toBe('roundOver');
    expect(ev.find((e) => e.type === 'roundEnded')).toMatchObject({
      result: {
        caller: 'a',
        callerFailed: false,
        scores: [
          { player: 'a', hand: 6, scored: 6 },
          { player: 'b', hand: 40, scored: 40 },
          { player: 'c', hand: 7, scored: 7 },
        ],
      },
    });
    // The round is over: every hand is shown to everyone.
    expect(viewFor(over, 'c', base).players[1]?.slots.every((x) => x.card !== null)).toBe(true);
  });

  it('locks the caller’s cards against the others’ powers', () => {
    const s = act(table(), { type: 'callTamalou', by: 'a' }, base).state;
    const drew = act(
      { ...s, deck: [...s.deck, s.cards.find((c) => c.rank === 'J' && c.suit === 'C')?.id as number] },
      { type: 'draw', by: 'b', from: 'deck' },
      base,
    ).state;
    const p = act(drew, { type: 'discardDrawn', by: 'b' }, base).state;
    expect(
      refuse(
        p,
        {
          type: 'usePower',
          by: 'b',
          targets: [
            { player: 'b', slot: 0 },
            { player: 'a', slot: 0 },
          ],
        },
        base,
      ),
    ).toBe('lockedSlot');
    expect(viewFor(p, 'b', base).players[0]?.slots.every((x) => x.locked)).toBe(true);
    expect(viewFor(p, 'a', base).players[0]?.slots.some((x) => x.locked)).toBe(false);
    const open = rules({ tamalou: { lockCallerCards: false } });
    expect(
      apply(
        p,
        {
          type: 'usePower',
          by: 'b',
          targets: [
            { player: 'b', slot: 0 },
            { player: 'a', slot: 0 },
          ],
        },
        open,
      ).ok,
    ).toBe(true);
  });

  const scoreAfterCall = (r: typeof base, caller: 'a' | 'c', hands?: Parameters<typeof rig>[1]['hands']) => {
    let s = table(r);
    if (hands) s = rig(s, { hands, discard: ['9C'], deck: ['8C', '8D', '8S', '8H'] });
    if (caller === 'c') s = play(s, [...passTurn('a'), ...passTurn('b')], r).state;
    s = act(s, { type: 'callTamalou', by: caller }, r).state;
    const others = caller === 'a' ? ['b', 'c'] : ['a', 'b'];
    s = play(s, others.flatMap(passTurn), r).state;
    return act(s, { type: 'endRound', by: 'host' }, r).state.results.at(-1);
  };

  it('penalises a caller who is not strictly lowest: +10 by default, or doubled', () => {
    const res = scoreAfterCall(base, 'c');
    expect(res).toMatchObject({
      callerFailed: true,
      scores: [{ player: 'a', scored: 6 }, {}, { player: 'c', hand: 7, scored: 17 }],
    });
    const doubled = rules({ tamalou: { failPenalty: { mode: 'double' } } });
    expect(scoreAfterCall(doubled, 'c')?.scores[2]?.scored).toBe(14);
  });

  it('counts a tie as a failed call', () => {
    const res = scoreAfterCall(base, 'a', { a: ['AH', '2H', '3H', 'KD'], c: ['AS', '2S', '3S', 'KH'] });
    expect(res?.callerFailed).toBe(true);
    expect(res?.scores[0]).toMatchObject({ player: 'a', hand: 6, scored: 16 });
  });

  it('zeroes a winning caller with the bonus on', () => {
    const r = rules({ tamalou: { winBonus: 'zero' } });
    expect(scoreAfterCall(r, 'a')?.scores[0]).toMatchObject({ hand: 6, scored: 0 });
  });

  it('reads card values from the rules, overrides first', () => {
    const r = rules({ values: { byRank: { A: 11 }, overrides: [] } });
    expect(scoreAfterCall(r, 'a')?.scores[0]?.hand).toBe(11 + 2 + 3 + 10);
  });

  it('offers the call after the turn with endOfTurn timing, and respects minTurnsBeforeCall', () => {
    const r = rules({ tamalou: { timing: 'endOfTurn', minTurnsBeforeCall: 1 } });
    const s = table(r);
    expect(legalActions(viewFor(s, 'a', r), r).some((x) => x.type === 'callTamalou')).toBe(false);
    expect(refuse(s, { type: 'callTamalou', by: 'a' }, r)).toBe('wrongStep');
    const after = play(s, passTurn('a'), r).state;
    expect(after.step).toBe('callDecision');
    const passed = act(after, { type: 'passCall', by: 'a' }, r).state;
    expect(passed.current).toBe('b');
    const called = act(after, { type: 'callTamalou', by: 'a' }, r).state;
    expect(called).toMatchObject({ caller: 'a', current: 'b', lastTurns: ['b', 'c'] });
    const early = rules({ tamalou: { minTurnsBeforeCall: 1 } });
    expect(refuse(table(early), { type: 'callTamalou', by: 'a' }, early)).toBe('callNotAllowed');
  });

  it('scores an empty hand 0, and can end the round with it', () => {
    const r = rules({ round: { emptyHandEndsRound: true } });
    const s = rig(newGame(r, 2).state, {
      hands: { a: ['9H', null, null, null], b: ['2S', '3S', '4S', '5S'] },
      discard: ['9C'],
    });
    const { state } = act(s, { type: 'quickDiscard', by: 'a', target: { player: 'a', slot: 0 }, expectTop: top(s) }, r);
    expect(state.phase).toBe('roundEnding');
    const over = act(state, { type: 'endRound', by: 'host' }, r).state;
    expect(over.results[0]?.scores[0]).toMatchObject({ player: 'a', hand: 0 });
    const off = act(
      s,
      { type: 'quickDiscard', by: 'a', target: { player: 'a', slot: 0 }, expectTop: top(s) },
      base,
    ).state;
    expect(off.phase).toBe('play');
  });
});

describe('game end', () => {
  const finishRound = (r: typeof base, s: ReturnType<typeof newGame>['state']) => {
    let st = act(s, { type: 'callTamalou', by: s.current as string }, r).state;
    while (st.phase === 'play') {
      const by = st.current as string;
      st = play(
        st,
        [
          { type: 'draw', by, from: 'deck' },
          { type: 'swap', by, slot: 0 },
        ],
        r,
      ).state;
    }
    return act(st, { type: 'endRound', by: 'host' }, r).state;
  };

  it('eliminates at 100 and ends with the last player standing', () => {
    let s = newGame(base, 3).state;
    s = { ...s, players: s.players.map((p) => ({ ...p, total: p.id === 'a' ? 0 : 95 })) };
    s = rig(s, { hands: { a: ['AH', 'AS', 'AD', 'AC'], b: ['10S', 'JS', 'QS', 'KS'], c: ['10H', 'JH', 'QH', '9H'] } });
    const over = finishRound(base, s);
    expect(over.phase).toBe('gameOver');
    expect(over.winners).toEqual(['a']);
    expect(over.results[0]?.eliminated).toEqual(['b', 'c']);
  });

  it('stops at the first elimination in that variant, lowest total wins', () => {
    const r = rules({ gameEnd: { thresholdEnd: 'firstElimination' } });
    let s = newGame(r, 3).state;
    s = { ...s, players: s.players.map((p) => ({ ...p, total: p.id === 'b' ? 95 : 0 })) };
    s = rig(s, { hands: { a: ['AH', 'AS', 'AD', 'AC'], b: ['10S', 'JS', 'QS', 'KS'], c: ['10H', 'JH', '2H', '3H'] } });
    const over = finishRound(r, s);
    expect(over.winners).toEqual(['a']);
  });

  it('deals the next round from the next seat, skipping eliminated players', () => {
    let s = newGame(base, 3).state;
    s = { ...s, players: s.players.map((p) => ({ ...p, total: p.id === 'b' ? 95 : 0 })) };
    s = rig(s, { hands: { a: ['AH', 'AS', 'AD', 'AC'], b: ['10S', 'JS', 'QS', 'KS'], c: ['2H', '2S', '2D', '2C'] } });
    const over = finishRound(base, s);
    expect(over.phase).toBe('roundOver');
    const next = act(over, { type: 'nextRound', by: 'host' }, base).state;
    expect(next.round).toBe(2);
    expect(next.hands.b).toEqual([]);
    expect(next.current).toBe('c');
    expect(refuse(next, { type: 'draw', by: 'b', from: 'deck' }, base)).toBe('eliminated');
  });

  it('plays a fixed number of rounds, ties sharing the win', () => {
    const r = rules({ gameEnd: { mode: 'rounds', rounds: 1 }, tamalou: { failPenalty: { amount: 0 } } });
    // a calls with 10; b swaps the ace from the pile into slot 0 and also ends on 10.
    const s = rig(newGame(r, 2).state, {
      hands: { a: ['AH', '2H', '3H', '4H'], b: ['KS', '2S', '3S', '4S'] },
      deck: ['AC'],
    });
    const over = finishRound(r, s);
    expect(over.phase).toBe('gameOver');
    expect(over.players.map((p) => p.total)).toEqual([10, 10]);
    expect(over.winners).toEqual(['a', 'b']);
  });

  it('accepts host actions only in their phase', () => {
    const s = newGame(base).state;
    expect(refuse(s, { type: 'endRound', by: 'host' }, base)).toBe('wrongPhase');
    expect(refuse(s, { type: 'nextRound', by: 'host' }, base)).toBe('wrongPhase');
  });
});
