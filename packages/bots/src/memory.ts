import { buildCards, cardValue } from '@tamalou/engine';
import type { Card, CardId, GameEvent, PlayerId, RuleSet, SlotRef } from '@tamalou/shared';

// What a bot remembers, built ONLY from the events its player receives (public ones and its own), exactly what a
// human at the table could note. A bot never reads the game state: the host hands it its view and its events.
//
// Imperfect memory (medium level) is two knobs: a fact is noted with probability `retain`, and every own turn each
// remembered card about any slot is forgotten with probability `forget`. The discard pile is public and stays exact.

export interface MemoryProfile {
  /** Chance to note a card when it is seen. 1 = perfect. */
  retain: number;
  /** Chance, at each own turn, to forget each remembered slot. 0 = perfect. */
  forget: number;
}

const key = (r: SlotRef) => `${r.player}#${r.slot}`;

export class BotMemory {
  readonly me: PlayerId;
  private readonly rules: RuleSet;
  private readonly profile: MemoryProfile;
  private readonly random: () => number;
  private readonly cards: Card[];
  /** Cards known to sit in a slot. */
  private slots = new Map<string, Card>();
  /** The discard pile, bottom first. */
  private discard: Card[] = [];
  /** The card drawn and not yet placed, by whom, and whether it is public (taken from the discard). */
  private drawn: { player: PlayerId; card: Card | null } | null = null;

  constructor(me: PlayerId, rules: RuleSet, profile: MemoryProfile, random: () => number) {
    this.me = me;
    this.rules = rules;
    this.profile = profile;
    this.random = random;
    this.cards = buildCards(rules);
  }

  value(card: Pick<Card, 'rank' | 'suit'>): number {
    return cardValue(card, this.rules);
  }

  /** The card remembered at a slot, if any. */
  at(ref: SlotRef): Card | null {
    return this.slots.get(key(ref)) ?? null;
  }

  /** My own held card (after a draw), as I saw it. */
  holding(): Card | null {
    return this.drawn?.player === this.me ? this.drawn.card : null;
  }

  /** Mean value of the cards whose place I do not know: my estimate for any face-down card I have not seen. */
  unknownMean(): number {
    const placed = new Set<CardId>();
    for (const c of this.slots.values()) placed.add(c.id);
    for (const c of this.discard) placed.add(c.id);
    const h = this.holding();
    if (h) placed.add(h.id);
    let sum = 0;
    let n = 0;
    for (const c of this.cards) {
      if (placed.has(c.id)) continue;
      sum += this.value(c);
      n++;
    }
    return n === 0 ? 5 : sum / n;
  }

  /** Called at the start of each own turn: the medium bot's memory fades. */
  tick(): void {
    if (this.profile.forget <= 0) return;
    for (const k of [...this.slots.keys()]) if (this.random() < this.profile.forget) this.slots.delete(k);
  }

  private note(ref: SlotRef, card: Card): void {
    if (this.profile.retain >= 1 || this.random() < this.profile.retain) this.slots.set(key(ref), card);
    else this.slots.delete(key(ref));
  }

  private clear(ref: SlotRef): void {
    this.slots.delete(key(ref));
  }

  private move(from: SlotRef, to: SlotRef): void {
    const c = this.slots.get(key(from));
    this.slots.delete(key(from));
    if (c) this.slots.set(key(to), c);
    else this.slots.delete(key(to));
  }

  observe(events: readonly GameEvent[]): void {
    for (const e of events) this.observeOne(e);
  }

  private observeOne(e: GameEvent): void {
    switch (e.type) {
      case 'roundStarted':
        this.slots.clear();
        this.discard = [e.discardTop];
        this.drawn = null;
        break;
      case 'initialPeek':
        for (const { slot, card } of e.cards) this.note({ player: this.me, slot }, card);
        break;
      case 'drew':
        if (e.from === 'discard') this.discard.pop();
        this.drawn = { player: e.player, card: e.card ?? null };
        break;
      case 'drewCard':
        this.drawn = { player: this.me, card: e.card };
        break;
      case 'swapped': {
        const ref = { player: e.player, slot: e.slot };
        const placed = this.drawn?.card ?? null;
        if (placed) this.note(ref, placed);
        else this.clear(ref);
        this.discard.push(e.discarded);
        this.drawn = null;
        break;
      }
      case 'discarded':
        this.discard.push(e.card);
        this.drawn = null;
        break;
      case 'peeked':
        this.note(e.target, e.card);
        break;
      case 'cardsSwapped': {
        const a = this.slots.get(key(e.a));
        const b = this.slots.get(key(e.b));
        this.slots.delete(key(e.a));
        this.slots.delete(key(e.b));
        if (b) this.slots.set(key(e.a), b);
        if (a) this.slots.set(key(e.b), a);
        break;
      }
      case 'quickDiscard':
        this.clear(e.target);
        this.discard.push(e.card);
        if (e.give !== undefined) this.move({ player: e.player, slot: e.give }, e.target);
        break;
      case 'quickDiscardFailed':
        // The card was shown to everyone and went back to its place.
        this.note(e.target, e.card);
        break;
      case 'deckReshuffled':
        this.discard = this.discard.slice(-1);
        break;
      default:
        break;
    }
  }
}
