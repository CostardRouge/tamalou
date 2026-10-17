import type { Action, PlayerId, PlayerView } from '@tamalou/shared';
import { t } from '../i18n/index.ts';

// When the game master asks to confirm every move (rules.assist.confirmMoves, ADR-0016), a touch on a card that would
// send a move, or a Tamalou call, is staged first: the screen asks this question and waits for "Confirmer". The
// buttons that name their move (Piocher, Défausser, Passer…) go at once.

/** The question to ask before sending this move, or null when it goes without one. */
export function confirmQuestion(action: Action, view: PlayerView, nameOf: (id: PlayerId) => string): string | null {
  const me = view.me;
  switch (action.type) {
    case 'swap':
      return t('confirm_swap', { n: action.slot + 1 });
    case 'usePower': {
      const [first, second] = action.targets;
      if (!first) return null;
      if (second) return t('confirm_blind', { n: first.slot + 1, m: second.slot + 1, name: nameOf(second.player) });
      return first.player === me
        ? t('confirm_peekOwn', { n: first.slot + 1 })
        : t('confirm_peekOther', { n: first.slot + 1, name: nameOf(first.player) });
    }
    case 'queenDecide':
      if (!action.swapWith) return null;
      return action.swapWith.player === me
        ? t('confirm_queenMine', { n: action.swapWith.slot + 1 })
        : t('confirm_queen', { n: action.swapWith.slot + 1, name: nameOf(action.swapWith.player) });
    case 'quickDiscard':
      return action.give === undefined
        ? t('confirm_quick', { n: action.target.slot + 1 })
        : t('confirm_quickGive', {
            n: action.give + 1,
            m: action.target.slot + 1,
            name: nameOf(action.target.player),
          });
    case 'callTamalou':
      return t('confirm_call');
    default:
      return null;
  }
}
