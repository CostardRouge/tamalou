import { legalActions, nextRandom } from '@tamalou/engine';
import type { Action, Card, GameEvent, PlayerId, PlayerView, RuleSet, SlotRef } from '@tamalou/shared';
import { BotMemory, type MemoryProfile } from './memory.ts';

// The three bot levels (docs/SPEC.md §5.1). A bot sees only its own view and the events its player receives, picks
// among legalActions(view), and never touches the game state. Its timing (how long it "thinks") is the host's to apply,
// from `profile.delays`.

export const BOT_LEVELS = ['easy', 'medium', 'hard'] as const;
export type BotLevel = (typeof BOT_LEVELS)[number];

export interface BotProfile {
  level: BotLevel;
  /** easy plays at random among legal moves; the others think. */
  smart: boolean;
  memory: MemoryProfile;
  /** Gain, in points, a swap must bring to be worth it. */
  swapMargin: number;
  /** Calls only with an estimated hand at or under this. */
  callAt: number;
  /** ...and this far under the lowest opponent estimate (hard only). */
  callLead: number;
  /** Points added to the estimate per own card never seen: how much uncertainty scares the bot. */
  unknownRisk: number;
  /** Claims a quick discard when it remembers a matching card. */
  quickDiscard: boolean;
  /** Picks targets by who is most dangerous, keeps a drawn card matching one of its own to discard both. */
  tactics: boolean;
  /** Milliseconds the host should wait before a turn move and before a quick discard: [min, max]. */
  delays: { turn: [number, number]; quickDiscard: [number, number] };
}

export const PROFILES: Record<BotLevel, BotProfile> = {
  easy: {
    level: 'easy',
    smart: false,
    memory: { retain: 0, forget: 1 },
    swapMargin: 0,
    callAt: 0,
    callLead: 0,
    unknownRisk: 0,
    quickDiscard: false,
    tactics: false,
    delays: { turn: [700, 1400], quickDiscard: [1500, 3000] },
  },
  medium: {
    level: 'medium',
    smart: true,
    memory: { retain: 0.85, forget: 0.08 },
    swapMargin: 2,
    callAt: 6,
    callLead: 0,
    unknownRisk: 3,
    quickDiscard: true,
    tactics: false,
    delays: { turn: [600, 1200], quickDiscard: [900, 1800] },
  },
  hard: {
    level: 'hard',
    smart: true,
    memory: { retain: 1, forget: 0 },
    swapMargin: 1,
    callAt: 8,
    callLead: 2,
    unknownRisk: 1.5,
    quickDiscard: true,
    tactics: true,
    delays: { turn: [500, 1000], quickDiscard: [500, 1100] },
  },
};

/** After this many own turns in a round, any bot calls as soon as it may: a round cannot run forever. */
const FORCE_CALL_AFTER = 12;

export class Bot {
  readonly me: PlayerId;
  readonly profile: BotProfile;
  private readonly rules: RuleSet;
  private readonly memory: BotMemory;
  private readonly rngHolder: { rng: number };
  private lastTick = '';

  constructor(me: PlayerId, level: BotLevel, rules: RuleSet, seed: number) {
    this.me = me;
    this.profile = PROFILES[level];
    this.rules = rules;
    this.rngHolder = { rng: seed >>> 0 };
    this.memory = new BotMemory(me, rules, this.profile.memory, () => this.random());
  }

  private random(): number {
    const [r, next] = nextRandom(this.rngHolder.rng);
    this.rngHolder.rng = next;
    return r;
  }

  private pick<T>(items: T[]): T | undefined {
    return items[Math.floor(this.random() * items.length)];
  }

  /** Feed the bot the events its player receives (public ones and its own private ones), in order. */
  observe(events: readonly GameEvent[]): void {
    this.memory.observe(events);
  }

  /**
   * What the bot wants to do now, if anything: a quick discard at any moment, or its own move on its turn. null when it
   * has nothing to do (not its turn and nothing to claim).
   */
  decide(view: PlayerView): Action | null {
    const legal = legalActions(view, this.rules);
    if (legal.length === 0) return null;
    if (!this.profile.smart) return this.decideRandom(view, legal);

    const claim = this.quickDiscard(view, legal);
    if (claim) return claim;
    const turn = legal.filter((a) => a.type !== 'quickDiscard');
    if (turn.length === 0) return null;
    if (view.phase === 'initialPeek') return turn[0] ?? null;

    if (view.step === 'draw') {
      const tickKey = `${view.round}:${view.myTurns}`;
      if (tickKey !== this.lastTick) {
        this.lastTick = tickKey;
        this.memory.tick();
      }
    }
    return this.turnMove(view, turn) ?? turn[0] ?? null;
  }

  // ------------------------------------------------------------ easy

  private decideRandom(view: PlayerView, legal: Action[]): Action | null {
    const turn = legal.filter((a) => a.type !== 'quickDiscard');
    if (turn.length === 0) return null;
    const call = turn.find((a) => a.type === 'callTamalou');
    if (call && (view.myTurns >= FORCE_CALL_AFTER || this.random() < 0.12)) return call;
    const rest = turn.filter((a) => a.type !== 'callTamalou');
    return this.pick(rest.length > 0 ? rest : turn) ?? null;
  }

  // ------------------------------------------------------------ estimates

  private mySlots(view: PlayerView): SlotRef[] {
    const me = view.players.find((p) => p.id === this.me);
    return (me?.slots ?? []).filter((s) => s.filled).map((s) => ({ player: this.me, slot: s.slot }));
  }

  /** A slot's value: what I remember (or see in my view), else the mean of the unseen cards. */
  private slotValue(view: PlayerView, ref: SlotRef): { value: number; known: boolean; card: Card | null } {
    const shown = view.players.find((p) => p.id === ref.player)?.slots[ref.slot]?.card ?? null;
    const card = shown ?? this.memory.at(ref);
    if (card) return { value: this.memory.value(card), known: true, card };
    return { value: this.memory.unknownMean(), known: false, card: null };
  }

  private estimate(view: PlayerView, player: PlayerId): { total: number; unknown: number } {
    const seat = view.players.find((p) => p.id === player);
    let total = 0;
    let unknown = 0;
    for (const s of seat?.slots ?? []) {
      if (!s.filled) continue;
      const v = this.slotValue(view, { player, slot: s.slot });
      total += v.value;
      if (!v.known) unknown++;
    }
    return { total, unknown };
  }

  /** My worst slot: the highest remembered value, or an unknown one when that is worse on average. */
  private worstSlot(view: PlayerView): { ref: SlotRef; value: number; known: boolean } | null {
    let best: { ref: SlotRef; value: number; known: boolean } | null = null;
    for (const ref of this.mySlots(view)) {
      const v = this.slotValue(view, ref);
      if (!best || v.value > best.value || (v.value === best.value && !v.known && best.known)) {
        best = { ref, value: v.value, known: v.known };
      }
    }
    return best;
  }

  private opponents(view: PlayerView) {
    return view.players.filter((p) => p.id !== this.me && !p.eliminated);
  }

  /** Opponents ordered most dangerous first: the lowest estimated hand. */
  private threats(view: PlayerView) {
    return this.opponents(view)
      .map((p) => ({ id: p.id, ...this.estimate(view, p.id) }))
      .sort((a, b) => a.total - b.total);
  }

  private shouldCall(view: PlayerView): boolean {
    if (view.myTurns >= FORCE_CALL_AFTER) return true;
    const mine = this.estimate(view, this.me);
    const risky = mine.total + mine.unknown * this.profile.unknownRisk;
    if (risky > this.profile.callAt) return false;
    if (!this.profile.tactics) return mine.unknown <= 1;
    const lowest = this.threats(view)[0];
    return !lowest || risky + this.profile.callLead <= lowest.total;
  }

  // ------------------------------------------------------------ moves

  private quickDiscard(view: PlayerView, legal: Action[]): Action | null {
    if (!this.profile.quickDiscard || !view.discardTop) return null;
    const rank = view.discardTop.rank;
    const claims = legal.filter((a): a is Extract<Action, { type: 'quickDiscard' }> => a.type === 'quickDiscard');
    for (const a of claims) {
      if (a.target.player !== this.me) continue;
      if (this.slotValue(view, a.target).card?.rank === rank) return a;
    }
    if (!this.profile.tactics) return null;
    // An opponent's matching card, paying with my worst card (allowOpponentCards).
    const worst = this.worstSlot(view);
    for (const a of claims) {
      if (a.target.player === this.me || a.give !== worst?.ref.slot) continue;
      if (this.slotValue(view, a.target).card?.rank === rank) return a;
    }
    return null;
  }

  private turnMove(view: PlayerView, legal: Action[]): Action | null {
    const find = <T extends Action['type']>(type: T, test: (a: Extract<Action, { type: T }>) => boolean = () => true) =>
      legal.find((a): a is Extract<Action, { type: T }> => a.type === type && test(a as Extract<Action, { type: T }>));
    const margin = this.profile.swapMargin;

    switch (view.step) {
      case 'draw': {
        const call = find('callTamalou');
        if (call && this.shouldCall(view)) return call;
        const top = view.discardTop;
        const worst = this.worstSlot(view);
        const fromDiscard = find('draw', (a) => a.from === 'discard');
        if (top && worst && fromDiscard && worst.value - this.memory.value(top) > margin + 0.5) return fromDiscard;
        return find('draw', (a) => a.from === 'deck') ?? fromDiscard ?? null;
      }

      case 'place': {
        const card = view.drawn?.card;
        if (!card) return null;
        const v = this.memory.value(card);
        const worst = this.worstSlot(view);
        const discard = find('discardDrawn');
        if (this.profile.tactics && discard) {
          // Drop it, then quick-discard my own card of the same rank: two cards gone for one.
          const twin = this.mySlots(view).some((r) => this.slotValue(view, r).card?.rank === card.rank);
          if (twin && this.rules.quickDiscard.enabled) return discard;
        }
        if (worst && (worst.value - v > margin || !discard)) {
          return find('swap', (a) => a.slot === worst.ref.slot) ?? null;
        }
        // A low card replaces an unknown one even when the average says it is close: knowing my hand is worth it.
        const unknownSlot = this.mySlots(view).find((r) => !this.slotValue(view, r).known);
        if (unknownSlot && v <= 3) return find('swap', (a) => a.slot === unknownSlot.slot) ?? null;
        return discard ?? null;
      }

      case 'power':
        return this.power(view, legal) ?? find('skipPower') ?? null;

      case 'reveal': {
        if (view.reveal?.power !== 'peekThenSwap') return find('endReveal') ?? null;
        return this.queenDecision(view, legal);
      }

      case 'callDecision':
        return this.shouldCall(view) ? (find('callTamalou') ?? null) : (find('passCall') ?? null);

      default:
        return null;
    }
  }

  private power(view: PlayerView, legal: Action[]): Action | null {
    const uses = legal.filter((a): a is Extract<Action, { type: 'usePower' }> => a.type === 'usePower');
    if (uses.length === 0) return null;
    const unknown = (r: SlotRef) => !this.slotValue(view, r).known;
    const threatOrder = this.profile.tactics ? this.threats(view).map((t) => t.id) : [];
    const byThreat = (list: typeof uses) =>
      this.profile.tactics
        ? [...list].sort(
            (a, b) =>
              threatOrder.indexOf((a.targets.at(-1) as SlotRef).player) -
              threatOrder.indexOf((b.targets.at(-1) as SlotRef).player),
          )
        : list;

    switch (view.pendingPower?.power) {
      case 'peekOwn':
        return uses.find((a) => unknown(a.targets[0] as SlotRef)) ?? null;
      case 'peekOther': {
        const candidates = uses.filter((a) => unknown(a.targets[0] as SlotRef));
        return (this.profile.tactics ? byThreat(candidates)[0] : this.pick(candidates)) ?? null;
      }
      case 'blindSwap': {
        const worst = this.worstSlot(view);
        if (!worst) return null;
        // Trade my worst card for the opponent card that gains me the most.
        let best: { a: Action; gain: number } | null = null;
        for (const a of uses) {
          const [own, other] = a.targets as [SlotRef, SlotRef];
          if (own.slot !== worst.ref.slot) continue;
          const gain = worst.value - this.slotValue(view, other).value;
          if (!best || gain > best.gain) best = { a, gain };
        }
        const needed = this.profile.tactics ? this.profile.swapMargin + 0.5 : 4;
        return best && best.gain > needed ? best.a : null;
      }
      case 'peekThenSwap': {
        const worst = this.worstSlot(view);
        // A bad card in hand: look at an opponent's card to take it. Otherwise learn one of mine.
        if (worst?.known && worst.value >= 7) {
          const look = byThreat(
            uses.filter((a) => (a.targets[0] as SlotRef).player !== this.me && unknown(a.targets[0] as SlotRef)),
          );
          if (look[0]) return look[0];
        }
        return (
          uses.find((a) => (a.targets[0] as SlotRef).player === this.me && unknown(a.targets[0] as SlotRef)) ?? null
        );
      }
      default:
        return null;
    }
  }

  private queenDecision(view: PlayerView, legal: Action[]): Action | null {
    const keep = legal.find((a) => a.type === 'queenDecide' && a.swapWith === null) ?? null;
    const reveal = view.reveal;
    if (!reveal?.card) return keep;
    const seen = this.memory.value(reveal.card);
    const swaps = legal.filter(
      (a): a is Extract<Action, { type: 'queenDecide' }> => a.type === 'queenDecide' && a.swapWith !== null,
    );
    const margin = this.profile.swapMargin;
    if (reveal.target.player !== this.me) {
      // Take the opponent's card in place of my worst one.
      const worst = this.worstSlot(view);
      if (worst && worst.value - seen > margin) return swaps.find((a) => a.swapWith?.slot === worst.ref.slot) ?? keep;
      return keep;
    }
    // My card: give it away for the opponent card that is lowest on my estimate.
    let best: { a: Action; gain: number } | null = null;
    for (const a of swaps) {
      const gain = seen - this.slotValue(view, a.swapWith as SlotRef).value;
      if (!best || gain > best.gain) best = { a, gain };
    }
    return best && best.gain > margin + 1 ? best.a : keep;
  }
}
