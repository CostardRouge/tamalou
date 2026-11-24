import type { Card, GameEvent } from '@tamalou/shared';
import { describe, expect, it } from 'vitest';
import { discardStory, storyLine } from '../src/game/discardStory.ts';
import { setLang } from '../src/i18n/index.ts';

setLang('fr');
const card = (rank: Card['rank'], suit: Card['suit']): Card => ({ id: 0, rank, suit, deck: 0 });
const names: Record<string, string> = { me: 'Moi', ada: 'Ada', bob: 'Basile' };
const nameOf = (id: string) => names[id] ?? id;

const events: GameEvent[] = [
  { type: 'roundStarted', round: 1, starter: 'me', players: ['me', 'ada', 'bob'], discardTop: card('4', 'S') },
  { type: 'drew', player: 'me', from: 'deck' },
  { type: 'discarded', player: 'me', card: card('2', 'H') },
  { type: 'drew', player: 'ada', from: 'discard', card: card('2', 'H') },
  { type: 'swapped', player: 'ada', slot: 0, discarded: card('J', 'H') },
  { type: 'drew', player: 'bob', from: 'deck' },
  { type: 'discarded', player: 'bob', card: card('9', 'S') },
  { type: 'powerUsed', player: 'bob', power: 'peekOther', targets: [{ player: 'me', slot: 1 }] },
  { type: 'quickDiscard', player: 'ada', target: { player: 'ada', slot: 2 }, card: card('9', 'C') },
];

describe('the discard laid out', () => {
  const story = discardStory(events);

  it('lists the cards newest first, who threw each and how, and the ones taken back', () => {
    expect(story.reshuffled).toBe(false);
    expect(story.cards.map((c) => [c.card.rank, c.by, c.how, c.takenBy])).toEqual([
      ['9', 'ada', 'quick', null],
      ['9', 'bob', 'thrown', null],
      ['J', 'ada', 'swapped', null],
      ['2', 'me', 'thrown', 'ada'],
      ['4', null, 'dealt', null],
    ]);
    expect(story.cards[1]?.power).toBe('peekOther');
  });

  it('tells each card in a sentence, to me in the second person', () => {
    const [quick, bob, , mine, dealt] = story.cards;
    expect(quick && storyLine(quick, nameOf, 'me')).toBe('Ada l’a jetée en défausse rapide.');
    expect(bob && storyLine(bob, nameOf, 'me')).toBe(
      'Basile l’a piochée puis jetée. Pouvoir : Regarder une carte adverse.',
    );
    expect(mine && storyLine(mine, nameOf, 'me')).toBe(
      'Tu l’as piochée puis jetée. Puis Ada l’a reprise : elle est dans sa main.',
    );
    expect(dealt && storyLine(dealt, nameOf, 'me')).toBe('Retournée à la donne.');
  });

  it('starts again from the top card when the deck is rebuilt, and at a new round', () => {
    const after = discardStory([...events, { type: 'deckReshuffled', size: 40 }]);
    expect(after.reshuffled).toBe(true);
    expect(after.cards.map((c) => c.card.rank)).toEqual(['9']);
    const next = discardStory([
      ...events,
      { type: 'roundStarted', round: 2, starter: 'ada', players: ['me', 'ada', 'bob'], discardTop: card('K', 'D') },
    ]);
    expect(next.cards.map((c) => c.card.rank)).toEqual(['K']);
  });
});
