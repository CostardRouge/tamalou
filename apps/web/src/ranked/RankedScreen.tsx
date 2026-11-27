import { formatCode, nameText, newSecret, normalizeCode } from '@tamalou/ranking';
import type { Avatar as AvatarValue } from '@tamalou/shared';
import { useEffect, useRef, useState } from 'react';
import { CardView } from '../cards/CardView.tsx';
import { focusOnMount } from '../game/Overlay.tsx';
import { currentLang, type Key, plural, t } from '../i18n/index.ts';
import { Avatar } from '../profile/Avatar.tsx';
import {
  createProfile,
  deleteProfile,
  fetchProfile,
  profileData,
  type RankedError,
  type RankedPlayer,
  renameProfile,
} from './api.ts';
import { forgetRanked, saveRankedSecret, useRankedSecret } from './store.ts';

// The «Classé» screen (the owner's pick C on the 2026-11-27 canvas, ADR-0029), step R0: the ranked profile alone.
// Without one: what it is, «Créer mon profil classé» or «J'ai déjà un code». With one: the name strangers see (drawn,
// never typed) and a new draw, the level still «en calibrage», the recovery code to note, the player's data to download
// and the profile to delete. Ranked games against bots come with R1.

/** Ranked games a level waits for (ADR-0029): before, it says «en calibrage». */
export const CALIBRATION_GAMES = 10;

const ERROR_KEY: Record<RankedError, Key> = {
  unknown: 'rankedErrorUnknown',
  exists: 'rankedErrorOffline',
  badCode: 'rankedErrorBadCode',
  slowDown: 'rankedErrorSlow',
  offline: 'rankedErrorOffline',
};

/** A stored name, in the reader's language. */
export const rankedName = (key: string) => nameText(key, currentLang() === 'en' ? 'en' : 'fr');

function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type View = 'loading' | 'intro' | 'restore' | 'ready' | 'down';

export function RankedScreen({ avatar, onClose }: { avatar: AvatarValue; onClose: () => void }) {
  const secret = useRankedSecret();
  const [player, setPlayer] = useState<RankedPlayer | null>(null);
  const [view, setView] = useState<View>(secret ? 'loading' : 'intro');
  const [fresh, setFresh] = useState(false);
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [tries, setTries] = useState(0);
  /** The secret whose profile is on screen: a profile just made or restored is not fetched again. */
  const known = useRef<string | null>(null);

  // The profile behind this device's secret, telling the server the avatar shown here.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per secret (or retry); the avatar goes with it
  useEffect(() => {
    if (!secret) {
      setView((v) => (v === 'restore' ? v : 'intro'));
      return;
    }
    if (known.current === secret) {
      setView('ready');
      return;
    }
    let live = true;
    setView('loading');
    fetchProfile(secret, avatar).then((r) => {
      if (!live) return;
      if (r.ok) {
        known.current = secret;
        setPlayer(r.value);
        setView('ready');
      } else if (r.error === 'unknown') {
        // Deleted from another phone, or 13 months without a ranked game.
        forgetRanked();
        setNotice(t('rankedGone'));
        setView('intro');
      } else setView('down');
    });
    return () => {
      live = false;
    };
  }, [secret, tries]);

  const fail = (error: RankedError) => setNotice(t(ERROR_KEY[error]));

  const create = async () => {
    setBusy(true);
    setNotice(null);
    const s = newSecret();
    const r = await createProfile(s, avatar);
    setBusy(false);
    if (!r.ok) return fail(r.error);
    known.current = s;
    setPlayer(r.value);
    setFresh(true);
    saveRankedSecret(s);
  };

  const restore = async () => {
    const s = normalizeCode(typed);
    if (!s) return setNotice(t('rankedErrorBadCode'));
    setBusy(true);
    setNotice(null);
    const r = await fetchProfile(s, avatar);
    setBusy(false);
    if (!r.ok) return fail(r.error);
    known.current = s;
    setPlayer(r.value);
    setTyped('');
    saveRankedSecret(s);
  };

  const redraw = async () => {
    if (!secret) return;
    setBusy(true);
    const r = await renameProfile(secret);
    setBusy(false);
    if (r.ok) setPlayer(r.value);
    else fail(r.error);
  };

  const data = async () => {
    if (!secret) return;
    const r = await profileData(secret);
    if (r.ok) download(r.value, `tamalou-profil-classe-${new Date().toISOString().slice(0, 10)}.json`);
    else fail(r.error);
  };

  const remove = async () => {
    if (!secret) return;
    setBusy(true);
    const r = await deleteProfile(secret);
    setBusy(false);
    if (!r.ok && r.error !== 'unknown') return fail(r.error);
    setAsking(false);
    known.current = null;
    setPlayer(null);
    setFresh(false);
    forgetRanked();
    setNotice(t('rankedDeleted'));
  };

  const copy = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(formatCode(secret));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShown(true);
    }
  };

  const head = (
    <div className="panel-head">
      <h2 id="ranked-title" className="field-title">
        {t('ranked')}
      </h2>
      <button type="button" className="ghost" onClick={onClose} ref={focusOnMount}>
        {t('close')}
      </button>
    </div>
  );
  const note = notice ? (
    <p className="notice" role="status">
      {notice}
    </p>
  ) : null;

  if (view === 'loading' || view === 'down') {
    return (
      <section className="ranked" aria-labelledby="ranked-title">
        {head}
        {view === 'loading' ? (
          <p className="muted" role="status">
            {t('rankedLoading')}
          </p>
        ) : (
          <>
            <p className="notice" role="status">
              {t('rankedErrorOffline')}
            </p>
            <button type="button" className="btn btn-secondary" onClick={() => setTries((n) => n + 1)}>
              {t('rankedRetry')}
            </button>
          </>
        )}
      </section>
    );
  }

  if (view === 'restore' && !player) {
    return (
      <section className="ranked" aria-labelledby="ranked-title">
        {head}
        <form
          className="ranked-restore"
          onSubmit={(e) => {
            e.preventDefault();
            void restore();
          }}
        >
          <label className="field">
            <span className="field-title">{t('rankedCodeLabel')}</span>
            <input
              className="mono ranked-code-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={40}
              ref={focusOnMount}
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={busy || !typed.trim()}>
            {t('rankedRestore')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setView('intro')}>
            {t('rankedBack')}
          </button>
        </form>
        {note}
      </section>
    );
  }

  if (!player || !secret) {
    return (
      <section className="ranked" aria-labelledby="ranked-title">
        {head}
        <div className="ranked-hero">
          <CardView card={null} label="" size="md" />
          <span className="ranked-words">
            <b>{t('rankedIntroTitle')}</b>
            <small>{t('rankedIntro')}</small>
          </span>
        </div>
        <ul className="ranked-points">
          <li>{t('rankedPointCode')}</li>
          <li>{t('rankedPointName')}</li>
          <li>{t('rankedPointSoon')}</li>
        </ul>
        <button type="button" className="btn btn-primary" onClick={() => void create()} disabled={busy}>
          {t('rankedCreate')}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setNotice(null);
            setView('restore');
          }}
        >
          {t('rankedHaveCode')}
        </button>
        {note}
        <p className="ranked-legal muted">
          <a href={`${t('legalHref')}#classement`}>{t('rankedKept')}</a>
        </p>
      </section>
    );
  }

  const code = formatCode(secret);
  return (
    <section className="ranked" aria-labelledby="ranked-title">
      {head}
      <div className="ranked-me">
        <Avatar avatar={player.avatar ?? avatar} size="lg" />
        <span className="ranked-words">
          <b className="ranked-name">{rankedName(player.name)}</b>
          <small className="muted">{t('rankedNameHint')}</small>
          <button type="button" className="link" onClick={() => void redraw()} disabled={busy}>
            {t('rankedRedraw')}
          </button>
        </span>
      </div>

      <div className="ranked-level">
        <CardView card={null} label="" size="md" />
        <span className="ranked-words">
          <b>{t('rankedCalibrating')}</b>
          <small className="muted">{plural('rankedCalibratingText', player.games, { total: CALIBRATION_GAMES })}</small>
          <span className="ranked-bar" aria-hidden="true">
            <i style={{ width: `${(Math.min(player.games, CALIBRATION_GAMES) / CALIBRATION_GAMES) * 100}%` }} />
          </span>
        </span>
      </div>
      <button type="button" className="btn btn-primary" disabled>
        {t('rankedPlayBots')} · {t('rankedSoon')}
      </button>

      <section className={`ranked-code${fresh ? ' fresh' : ''}`} aria-labelledby="ranked-code-title">
        <h3 id="ranked-code-title">{t(fresh ? 'rankedFreshTitle' : 'rankedCodeLabel')}</h3>
        {fresh ? <p>{t('rankedFreshText')}</p> : null}
        <p className="mono ranked-code-value" aria-live="polite">
          {fresh || shown ? code : '•••••-•••••-•••••-•••••-•••••'}
        </p>
        <div className="ranked-code-actions">
          {fresh ? null : (
            <button type="button" className="btn btn-secondary" onClick={() => setShown((s) => !s)}>
              {t(shown ? 'rankedHide' : 'rankedShow')}
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={() => void copy()}>
            {t(copied ? 'rankedCopied' : 'rankedCopy')}
          </button>
          {fresh ? (
            <button type="button" className="btn btn-primary" onClick={() => setFresh(false)}>
              {t('rankedNoted')}
            </button>
          ) : null}
        </div>
        <small className="muted">{t('rankedCodeInFile')}</small>
      </section>

      <div className="ranked-file">
        <button type="button" className="btn btn-secondary" onClick={() => void data()}>
          {t('rankedData')}
        </button>
        <button type="button" className="btn btn-secondary danger" onClick={() => setAsking(true)}>
          {t('rankedDelete')}
        </button>
      </div>
      {asking ? (
        <div className="ranked-ask" role="alertdialog" aria-labelledby="ranked-ask-text">
          <p id="ranked-ask-text">{t('rankedDeleteAsk')}</p>
          <div className="ranked-file">
            <button type="button" className="btn btn-secondary" onClick={() => setAsking(false)}>
              {t('rankedCancel')}
            </button>
            <button type="button" className="btn btn-primary danger" onClick={() => void remove()} disabled={busy}>
              {t('rankedDeleteYes')}
            </button>
          </div>
        </div>
      ) : null}
      {note}
      <p className="ranked-legal muted">
        <a href={`${t('legalHref')}#classement`}>{t('rankedKept')}</a>
      </p>
    </section>
  );
}
