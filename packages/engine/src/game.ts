import {
  type Action,
  type Card,
  type CardId,
  type GameEvent,
  type PlayerId,
  type Power,
  type RoundResult,
  type RuleSet,
  type SlotRef,
  STANDARD_RANKS,
  SUITS,
} from '@tamalou/shared';
import { shuffleInPlace } from './rng.ts';
import { cardValue, handValue } from './score.ts';
import {
  activePlayers,
  cardOf,
  type EngineError,
  filledSlots,
  type GameState,
  isLocked,
  seatOf,
  slotCard,
  topOfDiscard,
} from './state.ts';

// The reducer: (state, action, rules) → { state, events }. It never mutates its input (it works on a clone), never
// reads a clock and draws every random number from the state's own generator.

export type ApplyResult = { ok: true; state: GameState; events: GameEvent[] } | { ok: false; error: EngineError };

export interface NewGame {
  seed: number;
  players: { id: PlayerId; name: string }[];
  rules: RuleSet;
}

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

export function buildCards(rules: RuleSet): Card[] {
  const cards: Card[] = [];
  for (let deck = 0; deck < rules.deck.count; deck++) {
    for (const suit of SUITS) for (const rank of STANDARD_RANKS) cards.push({ id: cards.length, rank, suit, deck });
    if (rules.deck.jokers) {
      for (let j = 0; j < rules.deck.jokersPerDeck; j++)
        cards.push({ id: cards.length, rank: 'JOKER', suit: null, deck });
    }
  }
  return cards;
}

/** Creates a game and deals its first round. Throws on a setup that cannot be played (it is not a player's move). */
export function createGame({ seed, players, rules }: NewGame): { state: GameState; events: GameEvent[] } {
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new Error(`a game needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players`);
  }
  if (new Set(players.map((p) => p.id)).size !== players.length) throw new Error('duplicate player id');
  const cards = buildCards(rules);
  // Every hand, the first discard, and at least one card left to draw.
  if (players.length * rules.hand.size + 2 > cards.length) throw new Error('not enough cards for this table');

  const state: GameState = {
    seed: seed >>> 0,
    rng: seed >>> 0,
    cards,
    players: players.map((p) => ({ id: p.id, name: p.name, total: 0, eliminated: false })),
    round: 0,
    phase: 'initialPeek',
    step: null,
    current: null,
    starter: 0,
    deck: [],
    discard: [],
    hands: {},
    drawn: null,
    pendingPower: null,
    reveal: null,
    window: false,
    caller: null,
    lastTurns: [],
    turns: {},
    peek: {},
    knows: {},
    results: [],
    winners: null,
  };
  const events: GameEvent[] = [];
  dealRound(state, rules, events);
  return { state, events };
}

function dealRound(s: GameState, rules: RuleSet, events: GameEvent[]): void {
  s.round += 1;
  s.deck = s.cards.map((c) => c.id);
  shuffleInPlace(s.deck, s);
  s.discard = [];
  s.hands = {};
  s.turns = {};
  s.peek = {};
  s.knows = {};
  s.drawn = null;
  s.pendingPower = null;
  s.reveal = null;
  s.caller = null;
  s.lastTurns = [];
  s.window = false;
  const active = activePlayers(s);
  for (const p of s.players) {
    s.hands[p.id] = [];
    s.turns[p.id] = 0;
    s.knows[p.id] = [];
  }
  for (let i = 0; i < rules.hand.size; i++) for (const p of active) s.hands[p.id]?.push(s.deck.pop() as CardId);
  const first = s.deck.pop() as CardId;
  s.discard.push(first);
  learnAll(s, first);
  const starter = s.players[s.starter] as (typeof s.players)[number];
  events.push({
    type: 'roundStarted',
    round: s.round,
    starter: starter.id,
    players: active.map((p) => p.id),
    discardTop: cardOf(s, first),
  });

  const { mode, count, slots } = rules.hand.initialPeek;
  for (const p of active) {
    if (count === 0) {
      s.peek[p.id] = { slots: [], ready: true };
    } else if (mode === 'fixed') {
      s.peek[p.id] = { slots: [...slots], ready: false };
      showInitialPeek(s, p.id, slots, events);
    } else {
      s.peek[p.id] = { slots: null, ready: false };
    }
  }
  s.phase = 'initialPeek';
  s.step = null;
  s.current = null;
  maybeStartPlay(s, events);
}

function showInitialPeek(s: GameState, player: PlayerId, slots: number[], events: GameEvent[]): void {
  const cards = slots.map((slot) => {
    const id = s.hands[player]?.[slot] as CardId;
    learn(s, player, id);
    return { slot, card: cardOf(s, id) };
  });
  events.push({ type: 'initialPeek', to: player, cards });
}

function maybeStartPlay(s: GameState, events: GameEvent[]): void {
  if (!activePlayers(s).every((p) => s.peek[p.id]?.ready)) return;
  const starter = s.players[s.starter] as (typeof s.players)[number];
  s.phase = 'play';
  s.step = 'draw';
  s.current = starter.id;
  // The first face-up card opens a window, like any card landing on the discard.
  s.window = true;
  events.push({ type: 'playStarted', current: starter.id });
  events.push({ type: 'turnStarted', player: starter.id });
}

// ---------------------------------------------------------------- knowledge

function learn(s: GameState, player: PlayerId, card: CardId): void {
  const k = s.knows[player];
  if (k && !k.includes(card)) k.push(card);
}

/** A card shown face up to the whole table. */
function learnAll(s: GameState, card: CardId): void {
  for (const p of s.players) learn(s, p.id, card);
}

// ---------------------------------------------------------------- pile

/** Takes the top of the pile, rebuilding it from the discard (all but its top) when it is empty. */
function drawFromDeck(s: GameState, events: GameEvent[]): CardId | null {
  if (s.deck.length === 0) {
    if (s.discard.length <= 1) return null;
    const top = s.discard.pop() as CardId;
    s.deck = s.discard;
    s.discard = [top];
    // A reshuffled card's place is unknown to everyone again.
    for (const p of s.players) s.knows[p.id] = (s.knows[p.id] ?? []).filter((c) => !s.deck.includes(c));
    shuffleInPlace(s.deck, s);
    events.push({ type: 'deckReshuffled', size: s.deck.length });
  }
  return s.deck.pop() ?? null;
}

// ---------------------------------------------------------------- turn flow

function canCall(s: GameState, rules: RuleSet, player: PlayerId): boolean {
  return s.caller === null && (s.turns[player] ?? 0) >= rules.tamalou.minTurnsBeforeCall;
}

/** The current player's turn is over: offer a call (endOfTurn timing) or pass to the next player. */
function endTurn(s: GameState, rules: RuleSet, events: GameEvent[]): void {
  const player = s.current as PlayerId;
  s.turns[player] = (s.turns[player] ?? 0) + 1;
  s.window = true;
  if (checkEmptyHand(s, rules, events)) return;
  if (rules.tamalou.timing === 'endOfTurn' && canCall(s, rules, player)) {
    s.step = 'callDecision';
    return;
  }
  advance(s, events);
}

function advance(s: GameState, events: GameEvent[]): void {
  const player = s.current as PlayerId;
  if (s.caller !== null) {
    s.lastTurns = s.lastTurns.filter((p) => p !== player);
    if (s.lastTurns.length === 0) {
      enterRoundEnding(s);
      return;
    }
  }
  const order = s.players;
  const from = order.findIndex((p) => p.id === player);
  for (let i = 1; i <= order.length; i++) {
    const next = order[(from + i) % order.length] as (typeof order)[number];
    if (next.eliminated) continue;
    if (s.caller !== null && !s.lastTurns.includes(next.id)) continue;
    s.current = next.id;
    s.step = 'draw';
    events.push({ type: 'turnStarted', player: next.id });
    return;
  }
  enterRoundEnding(s);
}

/** The last turn is played: only quick discards remain, until the host scores the round. */
function enterRoundEnding(s: GameState): void {
  s.phase = 'roundEnding';
  s.step = null;
  s.current = null;
  s.drawn = null;
  s.pendingPower = null;
  s.reveal = null;
  s.window = true;
}

function checkEmptyHand(s: GameState, rules: RuleSet, _events: GameEvent[]): boolean {
  if (!rules.round.emptyHandEndsRound) return false;
  if (!activePlayers(s).some((p) => filledSlots(s, p.id).length === 0)) return false;
  enterRoundEnding(s);
  return true;
}

function finishPower(s: GameState, rules: RuleSet, events: GameEvent[]): void {
  s.pendingPower = null;
  s.reveal = null;
  endTurn(s, rules, events);
}

// ---------------------------------------------------------------- scoring

function scoreRound(s: GameState, rules: RuleSet, events: GameEvent[]): void {
  const active = activePlayers(s);
  events.push({
    type: 'handsRevealed',
    hands: active.map((p) => ({
      player: p.id,
      cards: (s.hands[p.id] ?? []).map((c) => (c === null ? null : cardOf(s, c))),
    })),
  });
  const hands = new Map(
    active.map((p) => [
      p.id,
      handValue(
        (s.hands[p.id] ?? []).map((c) => (c === null ? null : cardOf(s, c))),
        rules,
      ),
    ]),
  );
  const caller = s.caller;
  const callerHand = caller === null ? null : (hands.get(caller) ?? 0);
  // Strictly lowest, or the call fails: a tie is a failure (ADR-0006).
  const callerFailed =
    caller !== null && callerHand !== null && [...hands].some(([p, v]) => p !== caller && v <= callerHand);

  const scores = active.map((p) => {
    const hand = hands.get(p.id) ?? 0;
    let scored = hand;
    if (p.id === caller) {
      if (callerFailed) {
        const { mode, amount } = rules.tamalou.failPenalty;
        scored = mode === 'add' ? hand + amount : hand * 2;
      } else if (rules.tamalou.winBonus === 'zero') {
        scored = 0;
      }
    }
    p.total += scored;
    return { player: p.id, hand, scored, total: p.total };
  });

  const eliminated: PlayerId[] = [];
  if (rules.gameEnd.mode === 'threshold') {
    for (const p of active) {
      if (p.total >= rules.gameEnd.threshold) {
        p.eliminated = true;
        eliminated.push(p.id);
      }
    }
  }
  const result: RoundResult = { round: s.round, caller, callerFailed, scores, eliminated };
  s.results.push(result);
  events.push({ type: 'roundEnded', result });

  const winners = gameWinners(s, rules, eliminated);
  if (winners) {
    s.winners = winners;
    s.phase = 'gameOver';
    events.push({ type: 'gameEnded', winners, totals: s.players.map((p) => ({ player: p.id, total: p.total })) });
  } else {
    s.phase = 'roundOver';
  }
  s.step = null;
  s.current = null;
  s.window = false;
}

/** null while the game goes on; otherwise every player sharing the win (ADR-0006: ties share it). */
function gameWinners(s: GameState, rules: RuleSet, eliminatedNow: PlayerId[]): PlayerId[] | null {
  const lowest = (pool: typeof s.players) => {
    const min = Math.min(...pool.map((p) => p.total));
    return pool.filter((p) => p.total === min).map((p) => p.id);
  };
  const { mode, thresholdEnd, rounds } = rules.gameEnd;
  if (mode === 'rounds') return s.round >= rounds ? lowest(s.players) : null;
  const left = activePlayers(s);
  if (thresholdEnd === 'firstElimination') return eliminatedNow.length > 0 ? lowest(s.players) : null;
  if (left.length === 1) return left.map((p) => p.id);
  // Everyone left crossed the line in the same round: the lowest among them.
  if (left.length === 0) return lowest(s.players.filter((p) => eliminatedNow.includes(p.id)));
  return null;
}

// ---------------------------------------------------------------- apply

export function apply(state: GameState, action: Action, rules: RuleSet): ApplyResult {
  const s = structuredClone(state);
  const events: GameEvent[] = [];
  const error = step(s, action, rules, events);
  return error ? { ok: false, error } : { ok: true, state: s, events };
}

function step(s: GameState, a: Action, rules: RuleSet, events: GameEvent[]): EngineError | null {
  if (a.type === 'endRound') {
    if (s.phase !== 'roundEnding') return 'wrongPhase';
    scoreRound(s, rules, events);
    return null;
  }
  if (a.type === 'nextRound') {
    if (s.phase !== 'roundOver') return 'wrongPhase';
    const n = s.players.length;
    for (let i = 1; i <= n; i++) {
      const idx = (s.starter + i) % n;
      if (!s.players[idx]?.eliminated) {
        s.starter = idx;
        break;
      }
    }
    dealRound(s, rules, events);
    return null;
  }

  const seat = seatOf(s, a.by);
  if (!seat) return 'notAPlayer';
  if (seat.eliminated) return 'eliminated';
  const me = a.by;
  const hand = s.hands[me] ?? [];

  switch (a.type) {
    case 'choosePeek': {
      if (s.phase !== 'initialPeek') return 'wrongPhase';
      const p = s.peek[me];
      if (!p || rules.hand.initialPeek.mode !== 'choose') return 'wrongPhase';
      if (p.slots !== null) return 'alreadyChosen';
      const slots = a.slots;
      if (
        slots.length !== rules.hand.initialPeek.count ||
        new Set(slots).size !== slots.length ||
        slots.some((i) => !Number.isInteger(i) || i < 0 || i >= hand.length)
      ) {
        return 'badSlot';
      }
      p.slots = [...slots];
      showInitialPeek(s, me, slots, events);
      return null;
    }

    case 'ready': {
      if (s.phase !== 'initialPeek') return 'wrongPhase';
      const p = s.peek[me];
      if (!p) return 'wrongPhase';
      if (p.ready) return 'alreadyReady';
      if (p.slots === null) return 'notChosen';
      p.ready = true;
      events.push({ type: 'playerReady', player: me });
      maybeStartPlay(s, events);
      return null;
    }

    case 'draw': {
      if (s.phase !== 'play') return 'wrongPhase';
      if (s.current !== me) return 'notYourTurn';
      if (s.step !== 'draw') return 'wrongStep';
      if (a.from === 'deck') {
        const card = drawFromDeck(s, events);
        if (card === null) return 'deckEmpty';
        s.drawn = { card, from: 'deck' };
        learn(s, me, card);
        events.push({ type: 'drew', player: me, from: 'deck' });
        events.push({ type: 'drewCard', to: me, card: cardOf(s, card) });
      } else {
        const top = topOfDiscard(s);
        if (top === null) return 'discardEmpty';
        // A card from the discard must be swapped in: impossible with nothing left to swap it with.
        if (rules.discardPickup.mustSwap && filledSlots(s, me).length === 0) return 'mustSwap';
        s.discard.pop();
        s.drawn = { card: top, from: 'discard' };
        events.push({ type: 'drew', player: me, from: 'discard', card: cardOf(s, top) });
      }
      s.window = false;
      s.step = 'place';
      return null;
    }

    case 'swap': {
      if (s.phase !== 'play') return 'wrongPhase';
      if (s.current !== me) return 'notYourTurn';
      if (s.step !== 'place' || !s.drawn) return 'wrongStep';
      if (!Number.isInteger(a.slot) || a.slot < 0 || a.slot >= hand.length) return 'badSlot';
      const old = hand[a.slot];
      if (old === null || old === undefined) return 'emptySlot';
      hand[a.slot] = s.drawn.card;
      s.drawn = null;
      s.discard.push(old);
      learnAll(s, old);
      events.push({ type: 'swapped', player: me, slot: a.slot, discarded: cardOf(s, old) });
      endTurn(s, rules, events);
      return null;
    }

    case 'discardDrawn': {
      if (s.phase !== 'play') return 'wrongPhase';
      if (s.current !== me) return 'notYourTurn';
      if (s.step !== 'place' || !s.drawn) return 'wrongStep';
      const { card, from } = s.drawn;
      if (from === 'discard' && rules.discardPickup.mustSwap) return 'mustSwap';
      s.drawn = null;
      s.discard.push(card);
      learnAll(s, card);
      const c = cardOf(s, card);
      events.push({ type: 'discarded', player: me, card: c });
      const power: Power = rules.powers.byRank[c.rank];
      if (power !== 'none' && (from === 'deck' || rules.powers.activation === 'anyPile')) {
        // The power resolves before any quick discard on this card (ADR-0006): the window stays shut.
        s.pendingPower = { player: me, power };
        s.step = 'power';
        events.push({ type: 'powerOffered', player: me, power });
        return null;
      }
      endTurn(s, rules, events);
      return null;
    }

    case 'skipPower': {
      if (s.step !== 'power' || s.current !== me || !s.pendingPower) return 'wrongStep';
      events.push({ type: 'powerSkipped', player: me, power: s.pendingPower.power });
      finishPower(s, rules, events);
      return null;
    }

    case 'usePower': {
      if (s.step !== 'power' || s.current !== me || !s.pendingPower) return 'wrongStep';
      return usePower(s, rules, me, s.pendingPower.power, a.targets, events);
    }

    case 'endReveal': {
      if (s.step !== 'reveal' || s.current !== me || !s.reveal) return 'wrongStep';
      if (s.reveal.power === 'peekThenSwap') return 'wrongStep';
      finishPower(s, rules, events);
      return null;
    }

    case 'queenDecide': {
      if (s.step !== 'reveal' || s.current !== me || !s.reveal || s.reveal.power !== 'peekThenSwap') {
        return 'wrongStep';
      }
      if (a.swapWith !== null) {
        const target = s.reveal.target;
        const other = a.swapWith;
        const targetIsMine = target.player === me;
        const otherIsMine = other.player === me;
        if (targetIsMine === otherIsMine) return 'badTargets';
        const err = checkTarget(s, rules, me, other, otherIsMine ? 'own' : 'opponent');
        if (err) return err;
        swapSlots(s, target, other);
        events.push({ type: 'cardsSwapped', player: me, a: target, b: other, power: 'peekThenSwap' });
      }
      finishPower(s, rules, events);
      return null;
    }

    case 'callTamalou': {
      if (s.phase !== 'play' || s.current !== me) return 'notYourTurn';
      const timing = rules.tamalou.timing;
      if (timing === 'startOfTurn' && s.step !== 'draw') return 'wrongStep';
      if (timing === 'endOfTurn' && s.step !== 'callDecision') return 'wrongStep';
      if (!canCall(s, rules, me)) return 'callNotAllowed';
      s.caller = me;
      const order = s.players;
      const from = order.findIndex((p) => p.id === me);
      s.lastTurns = [];
      for (let i = 1; i < order.length; i++) {
        const p = order[(from + i) % order.length] as (typeof order)[number];
        if (!p.eliminated) s.lastTurns.push(p.id);
      }
      events.push({ type: 'tamalouCalled', player: me });
      events.push({ type: 'lastTurns', players: [...s.lastTurns] });
      // The call replaces the turn's draw; the card on the discard keeps its window open.
      s.window = true;
      advance(s, events);
      return null;
    }

    case 'passCall': {
      if (s.phase !== 'play' || s.current !== me) return 'notYourTurn';
      if (s.step !== 'callDecision') return 'wrongStep';
      events.push({ type: 'callPassed', player: me });
      advance(s, events);
      return null;
    }

    case 'quickDiscard':
      return quickDiscard(s, rules, me, a.target, a.expectTop, a.give, events);
  }
}

type Side = 'own' | 'opponent' | 'any';

function checkTarget(s: GameState, rules: RuleSet, me: PlayerId, ref: SlotRef, side: Side): EngineError | null {
  const seat = seatOf(s, ref.player);
  if (!seat || seat.eliminated) return 'badTargets';
  if (side === 'own' && ref.player !== me) return 'badTargets';
  if (side === 'opponent' && ref.player === me) return 'badTargets';
  const hand = s.hands[ref.player] ?? [];
  if (!Number.isInteger(ref.slot) || ref.slot < 0 || ref.slot >= hand.length) return 'badSlot';
  if (hand[ref.slot] === null) return 'emptySlot';
  if (isLocked(s, rules.tamalou.lockCallerCards, ref, me)) return 'lockedSlot';
  return null;
}

function swapSlots(s: GameState, a: SlotRef, b: SlotRef): void {
  const ha = s.hands[a.player] as (CardId | null)[];
  const hb = s.hands[b.player] as (CardId | null)[];
  const ca = ha[a.slot] as CardId | null;
  ha[a.slot] = hb[b.slot] as CardId | null;
  hb[b.slot] = ca;
}

function usePower(
  s: GameState,
  rules: RuleSet,
  me: PlayerId,
  power: Power,
  targets: SlotRef[],
  events: GameEvent[],
): EngineError | null {
  const sides: Record<Power, Side[]> = {
    none: [],
    peekOwn: ['own'],
    peekOther: ['opponent'],
    blindSwap: ['own', 'opponent'],
    peekThenSwap: ['any'],
  };
  const expected = sides[power];
  if (targets.length !== expected.length || expected.length === 0) return 'badTargets';
  for (const [i, side] of expected.entries()) {
    const err = checkTarget(s, rules, me, targets[i] as SlotRef, side);
    if (err) return err;
  }
  events.push({ type: 'powerUsed', player: me, power, targets: targets.map((t) => ({ ...t })) });

  if (power === 'blindSwap') {
    const [own, other] = targets as [SlotRef, SlotRef];
    swapSlots(s, own, other);
    events.push({ type: 'cardsSwapped', player: me, a: { ...own }, b: { ...other }, power });
    finishPower(s, rules, events);
    return null;
  }
  const target = targets[0] as SlotRef;
  const card = slotCard(s, target) as CardId;
  learn(s, me, card);
  s.reveal = { player: me, power, target: { ...target }, card };
  s.step = 'reveal';
  events.push({ type: 'peeked', to: me, target: { ...target }, card: cardOf(s, card) });
  return null;
}

function quickDiscard(
  s: GameState,
  rules: RuleSet,
  me: PlayerId,
  target: SlotRef,
  expectTop: CardId,
  give: number | undefined,
  events: GameEvent[],
): EngineError | null {
  if (!rules.quickDiscard.enabled) return 'quickDiscardDisabled';
  if (s.phase !== 'play' && s.phase !== 'roundEnding') return 'wrongPhase';
  if (!s.window) return 'windowClosed';
  const top = topOfDiscard(s);
  if (top === null) return 'discardEmpty';
  // Someone else's claim landed first: cancelled, no penalty (docs/SPEC.md §2).
  if (top !== expectTop) return 'staleTop';
  const own = target.player === me;
  if (!own && !rules.quickDiscard.allowOpponentCards) return 'opponentCardsDisabled';
  const err = checkTarget(s, rules, me, target, own ? 'own' : 'opponent');
  if (err) return err;
  const myHand = s.hands[me] as (CardId | null)[];
  if (
    !own &&
    (give === undefined || !Number.isInteger(give) || give < 0 || give >= myHand.length || myHand[give] === null)
  ) {
    return 'badGive';
  }

  const hand = s.hands[target.player] as (CardId | null)[];
  const claimed = hand[target.slot] as CardId;
  const card = cardOf(s, claimed);
  learnAll(s, claimed);
  if (card.rank === cardOf(s, top).rank) {
    hand[target.slot] = null;
    s.discard.push(claimed);
    if (!own) {
      hand[target.slot] = myHand[give as number] as CardId;
      myHand[give as number] = null;
    }
    events.push({ type: 'quickDiscard', player: me, target: { ...target }, card, ...(own ? {} : { give }) });
    checkEmptyHand(s, rules, events);
    return null;
  }

  // Wrong: the card goes back, and the claimer takes penalty cards face down, unseen, each in a new slot.
  const penalty: number[] = [];
  let missing = 0;
  for (let i = 0; i < rules.quickDiscard.penaltyCards; i++) {
    const drawn = drawFromDeck(s, events);
    if (drawn === null) {
      missing++;
      continue;
    }
    myHand.push(drawn);
    penalty.push(myHand.length - 1);
  }
  events.push({ type: 'quickDiscardFailed', player: me, target: { ...target }, card, penalty });
  if (missing > 0) events.push({ type: 'penaltySkipped', player: me, missing });
  return null;
}

/** Points of a card in this game; re-exported for the UI and bots. */
export { cardValue };
