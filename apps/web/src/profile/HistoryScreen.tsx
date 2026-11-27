import type { Avatar as AvatarValue } from '@tamalou/shared';
import { useRef, useState } from 'react';
import { focusOnMount } from '../game/Overlay.tsx';
import { currentLocale, type Key, ordinal, plural, t } from '../i18n/index.ts';
import { Avatar } from './Avatar.tsx';
import { historyFile, type PlayedGame, restoreHistory, summarize, useHistory } from './history.ts';

// «Mes parties» (the owner's pick HistoA on the 2026-11-24 canvas): the counts, the last games with my place, who
// played, when, how and my points, and the warning that it all lives on this phone, with a file to save it to and
// bring it back from.

const DAY = 86_400_000;

function when(at: number, now: number): string {
  const lang = currentLocale();
  const time = new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(at);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (at >= start.getTime()) return t('historyToday', { time });
  if (at >= start.getTime() - DAY) return t('historyYesterday', { time });
  const sameYear = new Date(at).getFullYear() === start.getFullYear();
  return new Intl.DateTimeFormat(lang, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(at);
}

function who(g: PlayedGame): string {
  if (!g.others.length) return t('historyAlone');
  const names = new Intl.ListFormat(currentLocale(), { type: 'conjunction', style: 'narrow' }).format(g.others);
  return t(g.mode === 'solo' ? 'historyAgainst' : 'historyWith', { names });
}

export function HistoryScreen({ avatar, onClose }: { avatar: AvatarValue; onClose: () => void }) {
  const games = useHistory();
  const sum = summarize(games);
  const file = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const now = Date.now();

  const save = () => {
    const blob = new Blob([historyFile(games)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tamalou-parties-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const restore = async (picked: File | undefined) => {
    if (!picked) return;
    const added = restoreHistory(await picked.text());
    setNotice(added === null ? t('historyRestoreBad') : plural('historyRestored', added));
    if (file.current) file.current.value = '';
  };

  return (
    <section className="history" aria-labelledby="history-title">
      <div className="panel-head">
        <div className="history-who">
          <Avatar avatar={avatar} size="md" />
          <span>
            <h2 id="history-title" className="field-title">
              {t('history')}
            </h2>
            {sum.since !== null ? (
              <small className="muted">
                {t('historySince', {
                  date: new Intl.DateTimeFormat(currentLocale(), { day: 'numeric', month: 'long' }).format(sum.since),
                })}
              </small>
            ) : null}
          </span>
        </div>
        <button type="button" className="ghost" onClick={onClose} ref={focusOnMount}>
          {t('close')}
        </button>
      </div>

      <div className="kpis">
        <div className="kpi">
          <b>{sum.games}</b>
          <span>{plural('historyGames', sum.games)}</span>
        </div>
        <div className="kpi">
          <b>{sum.won}</b>
          <span>{plural('historyWon', sum.won)}</span>
        </div>
        <div className="kpi">
          <b>{sum.made}</b>
          <span>{plural('historyMade', sum.made)}</span>
        </div>
      </div>

      {games.length ? (
        <section className="history-list" aria-labelledby="history-last">
          <h3 id="history-last">{t('historyLast')}</h3>
          <ol>
            {games.map((g) => (
              <li key={`${g.at}:${g.total}`}>
                <span className={`history-place${g.won ? ' first' : ''}`}>{ordinal(g.place)}</span>
                <span className="history-game">
                  <span className="history-names">{who(g)}</span>
                  <small>
                    {when(g.at, now)} · {t(`historyMode_${g.mode}` as Key)} · {plural('historyRounds', g.rounds)}
                  </small>
                </span>
                <span className="history-points mono">{plural('historyPoints', g.total)}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <p className="history-empty muted">{t('historyEmpty')}</p>
      )}

      <p className="history-local">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 9v4M12 17h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        </svg>
        <span>{t('historyLocal')}</span>
      </p>

      <div className="history-file">
        <button type="button" className="btn btn-secondary" onClick={save} disabled={!games.length}>
          {t('historySave')}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => file.current?.click()}>
          {t('historyRestore')}
        </button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => void restore(e.target.files?.[0])}
        />
      </div>
      {notice ? (
        <p className="notice" role="status">
          {notice}
        </p>
      ) : null}
    </section>
  );
}
