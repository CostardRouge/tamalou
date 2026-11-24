import type { Card, GameEvent, PlayerId, Power } from '@tamalou/shared';
import { type Key, t } from '../i18n/index.ts';

// The discard laid out (the owner's pick E on the 2026-11-24 canvas, rule assist.discardStory, ADR-0026): the cards
// that went on the discard since the round's deal or the last reshuffle, who threw each and how, and which were
// taken back. Built from the public events the screen has played, like the journal; pure, so the tests read it.

export interface StoryCard {
  /** The event that put it there: a stable key. */
  key: number;
  card: Card;
  /** Null for the card the deal turned over. */
  by: PlayerId | null;
  how: 'dealt' | 'thrown' | 'swapped' | 'quick';
  /** The power its player used with it, if any. */
  power: Power | null;
  /** Who took it back into their hand. */
  takenBy: PlayerId | null;
}

export interface DiscardStory {
  /** Newest first. */
  cards: StoryCard[];
  /** The deck was rebuilt from the discard at least once this round. */
  reshuffled: boolean;
}

export function discardStory(events: GameEvent[]): DiscardStory {
  let pile: StoryCard[] = [];
  let reshuffled = false;
  const top = () => pile.findLast((c) => c.takenBy === null);
  events.forEach((e, key) => {
    switch (e.type) {
      case 'roundStarted':
        pile = [{ key, card: e.discardTop, by: null, how: 'dealt', power: null, takenBy: null }];
        reshuffled = false;
        break;
      case 'discarded':
        pile.push({ key, card: e.card, by: e.player, how: 'thrown', power: null, takenBy: null });
        break;
      case 'swapped':
        pile.push({ key, card: e.discarded, by: e.player, how: 'swapped', power: null, takenBy: null });
        break;
      case 'quickDiscard':
        pile.push({ key, card: e.card, by: e.player, how: 'quick', power: null, takenBy: null });
        break;
      case 'powerUsed': {
        const last = top();
        if (last && last.by === e.player) last.power = e.power;
        break;
      }
      case 'drew': {
        const last = e.from === 'discard' ? top() : undefined;
        if (last) last.takenBy = e.player;
        break;
      }
      case 'deckReshuffled': {
        // The deck is rebuilt from all but the discard's top (engine `drawFromDeck`).
        const last = top();
        pile = last ? [last] : [];
        reshuffled = true;
        break;
      }
    }
  });
  return { cards: [...pile].reverse(), reshuffled };
}

/** What a card's story says, in the second person when it is mine (French conjugates). */
export function storyLine(c: StoryCard, nameOf: (id: PlayerId) => string, me: PlayerId): string {
  const said = (key: string, who: PlayerId) =>
    who === me ? t(`${key}_you` as Key) : t(key as Key, { name: nameOf(who) });
  const parts = [
    c.by === null
      ? t('storyDealt')
      : said(c.how === 'swapped' ? 'storySwapped' : c.how === 'quick' ? 'storyQuick' : 'storyThrown', c.by),
  ];
  if (c.power && c.power !== 'none') parts.push(t('storyPower', { power: t(`power_${c.power}` as Key) }));
  if (c.takenBy) parts.push(said('storyTakenBy', c.takenBy));
  return parts.join(' ');
}
