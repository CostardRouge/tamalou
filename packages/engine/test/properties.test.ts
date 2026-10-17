import {
  type CardId,
  type GameEvent,
  isVisibleTo,
  type PlayerView,
  parseRules,
  type RuleSetInput,
} from '@tamalou/shared';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  apply,
  createGame,
  type GameState,
  hostAction,
  legalActions,
  playRandomGame,
  replay,
  viewFor,
} from '../src/index.ts';

// Invariants over random legal games (docs/SPEC.md §7): the card count never changes, no card is ever in two places,
// and a player's view never shows a face that no event sent to that player revealed. Replaying a game's actions
// rebuilds the same state.

const variants: RuleSetInput[] = [
  {},
  { deck: { jokers: true }, quickDiscard: { allowOpponentCards: true, penaltyCards: 2 } },
  { tamalou: { timing: 'endOfTurn', lockCallerCards: false }, round: { emptyHandEndsRound: true } },
  { hand: { size: 6, columns: 3, initialPeek: { mode: 'choose', count: 3 } }, deck: { count: 2 } },
  { assist: { showKnownCards: true }, powers: { activation: 'anyPile' }, discardPickup: { mustSwap: false } },
  { gameEnd: { mode: 'rounds', rounds: 3 } },
];

const arb = fc.record({
  seed: fc.integer({ min: 0, max: 2 ** 32 - 1 }),
  players: fc.integer({ min: 2, max: 6 }),
  variant: fc.integer({ min: 0, max: variants.length - 1 }),
});

/** Every place a card can be, flattened. */
function locations(s: GameState): CardId[] {
  const inHands = Object.values(s.hands).flatMap((h) => h.filter((c): c is CardId => c !== null));
  return [...s.deck, ...s.discard, ...inHands, ...(s.drawn ? [s.drawn.card] : [])];
}

function faces(v: PlayerView): CardId[] {
  const out: CardId[] = [];
  for (const p of v.players) for (const sl of p.slots) if (sl.card) out.push(sl.card.id);
  if (v.drawn?.card) out.push(v.drawn.card.id);
  if (v.reveal?.card) out.push(v.reveal.card.id);
  if (v.discardTop) out.push(v.discardTop.id);
  return out;
}

/** Card ids an event shows to a player who receives it. */
function shown(e: GameEvent): CardId[] {
  switch (e.type) {
    case 'roundStarted':
      return [e.discardTop.id];
    case 'initialPeek':
      return e.cards.map((c) => c.card.id);
    case 'drew':
      return e.card ? [e.card.id] : [];
    case 'drewCard':
    case 'peeked':
    case 'discarded':
    case 'quickDiscard':
    case 'quickDiscardFailed':
      return [e.card.id];
    case 'swapped':
      return [e.discarded.id];
    case 'handsRevealed':
      return e.hands.flatMap((h) => h.cards.flatMap((c) => (c ? [c.id] : [])));
    default:
      return [];
  }
}

describe('engine invariants over random games', () => {
  it('keeps every card exactly once, and leaks nothing to any view', () => {
    fc.assert(
      fc.property(arb, ({ seed, players, variant }) => {
        const rules = parseRules(variants[variant]);
        const ids = Array.from({ length: players }, (_, i) => `p${i}`);
        let { state, events } = createGame({ seed, players: ids.map((id) => ({ id, name: id })), rules });
        const total = state.cards.length;
        // What each player has been shown, from the events they would receive.
        const seen = new Map(ids.map((id) => [id, new Set<CardId>()]));
        const receive = (evs: GameEvent[]) => {
          for (const e of evs)
            for (const id of ids) if (isVisibleTo(e, id)) for (const c of shown(e)) seen.get(id)?.add(c);
        };
        receive(events);
        const driver = { n: seed };
        for (let step = 0; step < 400 && state.phase !== 'gameOver'; step++) {
          // Plain checks in the loop: expect() per card per step made this test ten times slower.
          const where = locations(state);
          if (where.length !== total) throw new Error(`step ${step}: ${where.length} cards instead of ${total}`);
          if (new Set(where).size !== total) throw new Error(`step ${step}: a card is in two places`);
          for (const id of ids) {
            for (const c of faces(viewFor(state, id, rules))) {
              if (!seen.get(id)?.has(c)) throw new Error(`step ${step}: ${id} sees card ${c} it was never shown`);
            }
          }
          let action = hostAction(state);
          if (!action) {
            const legal = ids.flatMap((id) => legalActions(viewFor(state, id, rules), rules));
            if (legal.length === 0) throw new Error(`stuck in ${state.phase}/${state.step}`);
            driver.n = (Math.imul(driver.n, 1103515245) + 12345) >>> 0;
            action = legal[driver.n % legal.length] ?? null;
          }
          if (!action) break;
          const r = apply(state, action, rules);
          if (!r.ok) throw new Error(`legal action refused: ${JSON.stringify(action)} → ${r.error}`);
          state = r.state;
          events = r.events;
          receive(events);
        }
      }),
      { numRuns: 100 },
    );
  }, 120_000);

  it('replays a game from its seed and actions, to the same state', () => {
    fc.assert(
      fc.property(arb, ({ seed, players, variant }) => {
        const rules = parseRules(variants[variant]);
        const game = playRandomGame({ seed, players, rules, maxActions: 600 });
        const ids = game.state.players.map((p) => ({ id: p.id, name: p.name }));
        const again = replay({ seed, players: ids, rules, actions: game.actions });
        expect(again.state).toEqual(game.state);
        expect(again.events).toEqual(game.events);
      }),
      { numRuns: 40 },
    );
  }, 120_000);

  it('finishes random games without crashing or stalling', () => {
    for (let g = 0; g < 60; g++) {
      const rules = parseRules(variants[g % variants.length]);
      const r = playRandomGame({ seed: 1000 + g, players: 2 + (g % 5), rules });
      expect(r.outcome, `seed ${1000 + g}`).toBe('finished');
      expect(r.state.winners?.length).toBeGreaterThan(0);
    }
  }, 120_000);

  it('never mutates the state it is given', () => {
    const rules = parseRules();
    const { state } = createGame({
      seed: 3,
      players: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      rules,
    });
    const before = structuredClone(state);
    apply(state, { type: 'ready', by: 'a' }, rules);
    expect(state).toEqual(before);
  });
});
