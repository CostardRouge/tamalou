import type { PlayerId, PlayerView } from '@tamalou/shared';
import { en } from '../i18n/en.ts';
import { fr } from '../i18n/fr.ts';
import { t } from '../i18n/index.ts';

// Who the end-of-round panel names, and the line under its title. The player reading it is spoken to ("Tu as réussi
// ton Tamalou.") and their row shows their name with "(toi)" after it; on a device passed round several players,
// "toi" would only mean whoever holds it, so there everyone goes by name, in the third person.

/** What a solo game names a player who typed no name ("Moi", "Me"): that row reads "Toi" rather than "Moi (toi)". */
const DEFAULT_NAMES = new Set<string>([fr.homeNameDefault, en.homeNameDefault]);

export interface Seats {
  me: PlayerId;
  nameOf: (id: PlayerId) => string;
  /** One device, several players (pass-and-play). */
  shared: boolean;
}

export interface SeatLabel {
  name: string;
  /** The reading player, shown by name: the row adds "(toi)". */
  you: boolean;
}

export function seatLabel(id: PlayerId, s: Seats): SeatLabel {
  const name = s.nameOf(id);
  if (id !== s.me || s.shared) return { name, you: false };
  if (DEFAULT_NAMES.has(name)) return { name: t('you'), you: false };
  return { name, you: true };
}

const inline = (l: SeatLabel) => (l.you ? `${l.name} (${t('roundYou')})` : l.name);

/** The line under the panel's title: how the round ended, or who won the game. */
export function roundHeadline(view: PlayerView, s: Seats): string {
  const result = view.lastResult;
  if (!result) return '';
  const spokenTo = (id: PlayerId | null) => id === s.me && !s.shared;
  if (view.phase === 'gameOver') {
    const winners = view.winners ?? [];
    if (winners.length === 1) {
      const winner = winners[0] ?? '';
      return spokenTo(winner) ? t('youWin') : t('winner', { name: s.nameOf(winner) });
    }
    return t('winners', { names: winners.map((id) => inline(seatLabel(id, s))).join(', ') });
  }
  if (!result.caller) return t('roundNoCaller');
  if (spokenTo(result.caller)) return t(result.callerFailed ? 'roundCallerFailed_you' : 'roundCallerWon_you');
  return t(result.callerFailed ? 'roundCallerFailed' : 'roundCallerWon', { name: s.nameOf(result.caller) });
}
