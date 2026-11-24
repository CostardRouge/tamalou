import type { Card, GameEvent } from '@tamalou/shared';
import { describe, expect, it } from 'vitest';
import { journalFor, journalOf } from '../src/game/journal.ts';
import { setLang } from '../src/i18n/index.ts';

setLang('fr');
const card = (rank: Card['rank'], suit: Card['suit']): Card => ({ id: 0, rank, suit, deck: 0 });
const names: Record<string, string> = { me: 'Moi', ada: 'Ada', bob: 'Basile' };
const nameOf = (id: string) => names[id] ?? id;

// Two laps of a three-player table: me, Ada, Basile.
const events: GameEvent[] = [
  { type: 'roundStarted', round: 1, starter: 'me' } as GameEvent,
  { type: 'drew', player: 'me', from: 'deck' } as GameEvent,
  { type: 'discarded', player: 'me', card: card('2', 'H') },
  { type: 'drew', player: 'ada', from: 'discard', card: card('2', 'H') } as GameEvent,
  { type: 'swapped', player: 'ada', slot: 0, discarded: card('J', 'H') },
  { type: 'drew', player: 'bob', from: 'deck' } as GameEvent,
  { type: 'discarded', player: 'bob', card: card('9', 'S') },
  { type: 'powerUsed', player: 'bob', power: 'peekOther', targets: [{ player: 'me', slot: 1 }] },
  { type: 'quickDiscard', player: 'ada', target: { player: 'ada', slot: 2 }, card: card('9', 'C') },
  { type: 'drew', player: 'me', from: 'deck' } as GameEvent,
  { type: 'discarded', player: 'me', card: card('10', 'D') },
  { type: 'drew', player: 'ada', from: 'deck' } as GameEvent,
  { type: 'discarded', player: 'ada', card: card('K', 'C') },
  { type: 'drew', player: 'bob', from: 'deck' } as GameEvent,
  { type: 'discarded', player: 'bob', card: card('5', 'D') },
];

describe('the journal', () => {
  const items = journalOf(events, nameOf, 'me');

  it('groups a player’s go, names them once and keeps the card it threw', () => {
    expect(items[0]).toMatchObject({ kind: 'note', round: true, text: 'Manche 1 : tu commences.' });
    expect(items[1]).toMatchObject({ kind: 'turn', player: 'me', drew: true, card: card('2', 'H') });
    const ada = items[2];
    expect(ada?.kind === 'turn' && ada.lines.map((l) => l.text)).toEqual([
      'Prend 2 de cœur dans la défausse.',
      'Échange une carte et défausse Valet de cœur.',
    ]);
    expect(ada).toMatchObject({ card: card('J', 'H') });
  });

  it('marks a power, says when it was about my card, and keeps a quick discard apart', () => {
    const bob = items[3];
    expect(bob?.kind === 'turn' && bob.lines.at(-1)).toEqual({
      text: 'Regarde une de tes cartes.',
      mark: 'look',
      aboutMe: true,
    });
    expect(items[4]).toMatchObject({ kind: 'turn', player: 'ada', drew: false, card: card('9', 'C') });
    expect(items[4]?.kind === 'turn' && items[4].lines[0]?.mark).toBe('quick');
  });

  it('tells everything, the last lap of the table, or nothing', () => {
    expect(journalFor(items, 'full', 3)).toBe(items);
    expect(journalFor(items, 'off', 3)).toEqual([]);
    const recent = journalFor(items, 'recent', 3);
    expect(recent.map((i) => (i.kind === 'turn' ? i.player : 'round'))).toEqual(['me', 'ada', 'bob']);
    // Early in a round, the lap stops at the round's start.
    expect(journalFor(items.slice(0, 3), 'recent', 3)).toEqual(items.slice(0, 3));
  });
});
