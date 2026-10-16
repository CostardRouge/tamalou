import type { GameEvent, PlayerId } from '@tamalou/shared';
import { cardName, type Key, t } from '../i18n/index.ts';

// The public log (docs/SPEC.md §6): one line per event the player received. Private events (a peek, a drawn card)
// say only what the others see: who looked at which card, never what it was. A line about the player themself uses
// the `_you` variant of its key, because French conjugates ("tu pioches", not "tu pioche").

export function describeEvent(e: GameEvent, nameOf: (id: PlayerId) => string, me: PlayerId): string | null {
  const line = (key: Key, actor: PlayerId, params: Record<string, string | number> = {}) =>
    actor === me ? t(`${key}_you` as Key, params) : t(key, { name: nameOf(actor), ...params });
  switch (e.type) {
    case 'roundStarted':
      return line('logRoundStarted', e.starter, { round: e.round });
    case 'drew':
      return e.from === 'deck'
        ? line('logDrewDeck', e.player)
        : line('logDrewDiscard', e.player, { card: e.card ? cardName(e.card) : '' });
    case 'swapped':
      return line('logSwapped', e.player, { card: cardName(e.discarded) });
    case 'discarded':
      return line('logDiscarded', e.player, { card: cardName(e.card) });
    case 'powerSkipped':
      return line('logPowerSkipped', e.player);
    case 'powerUsed': {
      const target = e.targets.at(-1);
      if (e.power === 'blindSwap' || !target) return null; // cardsSwapped tells it
      if (target.player === e.player) return line('logPeekedOwn', e.player);
      if (target.player === me) return t('logPeekedYours', { name: nameOf(e.player) });
      return line('logPeekedOther', e.player, { target: nameOf(target.player) });
    }
    case 'cardsSwapped': {
      const other = e.a.player === e.player ? e.b.player : e.a.player;
      if (other === me) return t('logSwappedYours', { name: nameOf(e.player) });
      return line('logSwappedCards', e.player, { target: nameOf(other) });
    }
    case 'quickDiscard':
      return line('logQuickDiscard', e.player, { card: cardName(e.card) });
    case 'quickDiscardFailed':
      return line('logQuickFailed', e.player, { card: cardName(e.card) });
    case 'deckReshuffled':
      return t('logReshuffled');
    case 'tamalouCalled':
      return line('logCalled', e.player);
    case 'callPassed':
      return line('logPassed', e.player);
    case 'roundEnded':
      return t('logRoundEnded', { round: e.result.round });
    case 'gameEnded':
      return t('logGameEnded');
    default:
      return null;
  }
}
