import type { PlayerId, PlayerView } from '@tamalou/shared';
import { motion } from 'motion/react';
import { useEffect } from 'react';
import { trackEvent } from '../audience.ts';
import { CardView } from '../cards/CardView.tsx';
import type { GameConnection } from '../connection/types.ts';
import { cardName, t } from '../i18n/index.ts';

// The end of a round (docs/SPEC.md §6): every hand turned over one card after the other, the points of the round and
// the totals, then "next round". At the end of the game, the winners and the way back.

interface Props {
  view: PlayerView;
  conn: GameConnection;
  nameOf: (id: PlayerId) => string;
  onQuit: () => void;
  onReplay?: (() => void) | undefined;
}

/** The panel's main button takes the focus when it appears, so a keyboard continues with Enter. */
const focusOnMount = (el: HTMLButtonElement | null) => el?.focus();

export function RoundOver({ view, conn, nameOf, onQuit, onReplay }: Props) {
  const result = view.lastResult;
  const over = view.phase === 'gameOver';
  const rounds = result?.round ?? 0;
  useEffect(() => {
    if (over) trackEvent('game-over', { rounds });
  }, [over, rounds]);
  if (!result) return null;
  const waiting = conn.readyForNext().includes(view.me);
  const who = (id: PlayerId) => (id === view.me ? t('you') : nameOf(id));
  const winners = view.winners ?? [];

  let headline = t('roundNoCaller');
  if (result.caller)
    headline = t(result.callerFailed ? 'roundCallerFailed' : 'roundCallerWon', { name: who(result.caller) });
  if (over) {
    if (winners.length === 1)
      headline = winners[0] === view.me ? t('youWin') : t('winner', { name: nameOf(winners[0] ?? '') });
    else headline = t('winners', { names: winners.map(who).join(', ') });
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="round-title">
      <motion.div
        className="panel"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 24 }}
      >
        <h2 id="round-title">{over ? t('gameOver') : t('roundOver', { round: result.round })}</h2>
        <p className="headline">{headline}</p>
        <table className="scores">
          <thead>
            <tr>
              <th scope="col">{t('colPlayer')}</th>
              <th scope="col">{t('colHand')}</th>
              <th scope="col" className="num">
                {t('colRound')}
              </th>
              <th scope="col" className="num">
                {t('colTotal')}
              </th>
            </tr>
          </thead>
          <tbody>
            {result.scores.map((s, row) => {
              const seat = view.players.find((p) => p.id === s.player);
              const out = result.eliminated.includes(s.player);
              return (
                <tr key={s.player} className={winners.includes(s.player) ? 'win' : ''}>
                  <th scope="row">
                    {who(s.player)}
                    {s.player === result.caller ? <span className="badge">Tamalou</span> : null}
                    {out ? <span className="muted"> · {t('eliminated')}</span> : null}
                  </th>
                  <td>
                    <div className="hand-row">
                      {(seat?.slots ?? [])
                        .filter((sl) => sl.filled)
                        .map((sl, i) => (
                          <motion.div
                            key={sl.slot}
                            initial={{ rotateY: 180, opacity: 0.4 }}
                            animate={{ rotateY: 0, opacity: 1 }}
                            transition={{ delay: 0.15 * (row * 4 + i), duration: 0.35 }}
                          >
                            <CardView card={sl.card} size="sm" label={sl.card ? cardName(sl.card) : t('cardHidden')} />
                          </motion.div>
                        ))}
                    </div>
                  </td>
                  <td className="num mono">
                    {s.scored > s.hand ? (
                      <>
                        {s.hand} <span className="bad">+{s.scored - s.hand}</span>
                      </>
                    ) : (
                      s.scored
                    )}
                  </td>
                  <td className="num mono strong">{s.total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="buttons">
          {over ? (
            <>
              {onReplay ? (
                <button type="button" className="btn btn-primary" onClick={onReplay}>
                  {t('actReplay')}
                </button>
              ) : (
                <p className="muted">{t('waitingGameMaster')}</p>
              )}
              <button type="button" className="btn btn-secondary" onClick={onQuit}>
                {t('actHome')}
              </button>
            </>
          ) : waiting ? (
            <p className="muted">{t('waitingOthers')}</p>
          ) : (
            <button type="button" className="btn btn-primary" ref={focusOnMount} onClick={() => conn.continueRound()}>
              {t('actNextRound')}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
