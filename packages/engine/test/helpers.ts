import {
  type Action,
  type CardId,
  type GameEvent,
  mergeRuleInputs,
  type PlayerId,
  parseRules,
  type Rank,
  type RuleSet,
  type RuleSetInput,
  type Suit,
} from '@tamalou/shared';
import { expect } from 'vitest';
import { apply, createGame, type EngineError, type GameState } from '../src/index.ts';

/** Rules for unit tests: no initial peek, so play starts at once, plus whatever the test changes. */
export function rules(input: RuleSetInput = {}): RuleSet {
  return parseRules(mergeRuleInputs({ hand: { initialPeek: { count: 0 } } }, input));
}

export function newGame(r: RuleSet, n = 2, seed = 1) {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'].slice(0, n);
  return createGame({ seed, players: ids.map((id) => ({ id, name: id.toUpperCase() })), rules: r });
}

/** "7H", "10S", "KD", "JOKER". */
type CardSpec = string;

const parse = (spec: CardSpec): { rank: Rank; suit: Suit | null } => {
  if (spec === 'JOKER') return { rank: 'JOKER', suit: null };
  return { rank: spec.slice(0, -1) as Rank, suit: spec.slice(-1) as Suit };
};

/**
 * Puts chosen cards in chosen places: each hand, the discard (top last) and the top of the pile (top last). Every other
 * card goes under the pile, in table order. Knowledge is cleared.
 */
export function rig(
  s: GameState,
  spec: { hands?: Record<PlayerId, (CardSpec | null)[]>; discard?: CardSpec[]; deck?: CardSpec[] },
): GameState {
  const used = new Set<CardId>();
  const take = (c: CardSpec): CardId => {
    const { rank, suit } = parse(c);
    const card = s.cards.find((x) => x.rank === rank && x.suit === suit && !used.has(x.id));
    if (!card) throw new Error(`no free card ${c}`);
    used.add(card.id);
    return card.id;
  };
  const next: GameState = structuredClone(s);
  for (const [p, cards] of Object.entries(spec.hands ?? {})) {
    next.hands[p] = cards.map((c) => (c === null ? null : take(c)));
  }
  // Hands not given keep their cards.
  for (const [p, hand] of Object.entries(next.hands)) {
    if (spec.hands?.[p]) continue;
    next.hands[p] = hand.map((id) => {
      if (id === null) return null;
      const c = s.cards[id];
      return c ? take(c.suit === null ? 'JOKER' : `${c.rank}${c.suit}`) : null;
    });
  }
  const discard = (spec.discard ?? []).map(take);
  if (discard.length === 0) {
    const old = s.cards[s.discard[s.discard.length - 1] as CardId];
    if (old) discard.push(take(old.suit === null ? 'JOKER' : `${old.rank}${old.suit}`));
  }
  const deckTop = (spec.deck ?? []).map(take);
  const rest = s.cards.map((c) => c.id).filter((id) => !used.has(id));
  next.discard = discard;
  next.deck = [...rest, ...deckTop];
  for (const p of next.players) next.knows[p.id] = [];
  return next;
}

export function act(s: GameState, action: Action, r: RuleSet): { state: GameState; events: GameEvent[] } {
  const res = apply(s, action, r);
  if (!res.ok) throw new Error(`refused ${action.type}: ${res.error}`);
  return { state: res.state, events: res.events };
}

export function refuse(s: GameState, action: Action, r: RuleSet): EngineError {
  const res = apply(s, action, r);
  expect(res.ok).toBe(false);
  return (res as { ok: false; error: EngineError }).error;
}

/** Plays a sequence of actions, returning the final state and every event. */
export function play(s: GameState, actions: Action[], r: RuleSet) {
  const events: GameEvent[] = [];
  let state = s;
  for (const a of actions) {
    const res = act(state, a, r);
    state = res.state;
    events.push(...res.events);
  }
  return { state, events };
}

export const top = (s: GameState) => s.discard[s.discard.length - 1] as CardId;
export const label = (s: GameState, id: CardId | null | undefined) => {
  if (id === null || id === undefined) return null;
  const c = s.cards[id];
  return c ? (c.suit === null ? 'JOKER' : `${c.rank}${c.suit}`) : null;
};
export const handOf = (s: GameState, p: PlayerId) => (s.hands[p] ?? []).map((id) => label(s, id));
