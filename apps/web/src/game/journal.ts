import type { Card, GameEvent, PlayerId, RuleSet } from '@tamalou/shared';
import { describeEvent } from './log.ts';

// The journal (the owner's picks A and C on the 2026-11-24 canvas, ADR-0026): the public log grouped by turn, one
// block per player's go, with the card it left on the discard. `recent` keeps the last lap of the table (each player's
// last turn), `full` the whole game. Pure: GameScreen renders it, the tests read it.

/** What a line's mark shows: an eye, two arrows, the quick discard's bolt, the Tamalou call. */
export type JournalMark = 'look' | 'swap' | 'quick' | 'call';

export interface JournalLine {
  text: string;
  mark: JournalMark | null;
  /** Someone looked at, swapped or gave one of my cards. */
  aboutMe: boolean;
}

export interface JournalTurn {
  kind: 'turn';
  /** The index of the event that opened it: a stable key, the log only grows. */
  key: number;
  player: PlayerId;
  lines: JournalLine[];
  /** The last card this go left on the discard. */
  card: Card | null;
  /** A turn proper (it drew), not a quick discard or a call between turns. */
  drew: boolean;
}

export interface JournalNote {
  kind: 'note';
  key: number;
  text: string;
  /** A round starts here. */
  round: boolean;
}

export type JournalItem = JournalTurn | JournalNote;

/** "Ada pioche." under Ada's name reads "Pioche.": the block names the player once. My lines keep their "Tu". */
function bare(text: string, name: string): string {
  if (!text.startsWith(`${name} `)) return text;
  const rest = text.slice(name.length + 1);
  return rest.charAt(0).toLocaleUpperCase() + rest.slice(1);
}

function markOf(e: GameEvent): JournalMark | null {
  switch (e.type) {
    case 'powerUsed':
      return e.power === 'blindSwap' ? 'swap' : 'look';
    case 'cardsSwapped':
      return 'swap';
    case 'quickDiscard':
    case 'quickDiscardFailed':
      return 'quick';
    case 'tamalouCalled':
      return 'call';
    default:
      return null;
  }
}

function aboutMe(e: GameEvent, me: PlayerId): boolean {
  if (e.type === 'powerUsed') return e.player !== me && e.targets.some((t) => t.player === me);
  if (e.type === 'cardsSwapped') return e.player !== me && (e.a.player === me || e.b.player === me);
  if (e.type === 'cardGiven') return e.into.player === me;
  return false;
}

function thrown(e: GameEvent): Card | null {
  if (e.type === 'discarded' || e.type === 'quickDiscard') return e.card;
  if (e.type === 'swapped') return e.discarded;
  return null;
}

export function journalOf(events: GameEvent[], nameOf: (id: PlayerId) => string, me: PlayerId): JournalItem[] {
  const items: JournalItem[] = [];
  events.forEach((e, i) => {
    const text = describeEvent(e, nameOf, me);
    if (text === null) return;
    if (!('player' in e)) {
      items.push({ kind: 'note', key: i, text, round: e.type === 'roundStarted' });
      return;
    }
    const last = items.at(-1);
    const line: JournalLine = { text: bare(text, nameOf(e.player)), mark: markOf(e), aboutMe: aboutMe(e, me) };
    // A draw opens a turn; anything else by the same player joins the go it follows.
    if (last?.kind === 'turn' && last.player === e.player && e.type !== 'drew') {
      last.lines.push(line);
      last.card = thrown(e) ?? last.card;
      return;
    }
    items.push({ kind: 'turn', key: i, player: e.player, lines: [line], card: thrown(e), drew: e.type === 'drew' });
  });
  return items;
}

/**
 * What the rules let the journal tell: everything, or the last lap of the table (from the oldest of every player's
 * last turn, never before the round's start), or nothing.
 */
export function journalFor(items: JournalItem[], mode: RuleSet['assist']['log'], seats: number): JournalItem[] {
  if (mode === 'off') return [];
  if (mode === 'full') return items;
  const seen = new Set<PlayerId>();
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (!it) continue;
    if (it.kind === 'note' && it.round) return items.slice(i);
    if (it.kind === 'turn' && it.drew) {
      seen.add(it.player);
      if (seen.size >= seats) return items.slice(i);
    }
  }
  return items;
}
