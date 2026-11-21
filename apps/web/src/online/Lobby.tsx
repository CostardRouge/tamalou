import { BOT_LEVELS, type BotLevel } from '@tamalou/bots';
import { tableFits } from '@tamalou/engine';
import { PRESETS, rulesOf, type SeatInfo } from '@tamalou/shared';
import { type CSSProperties, useMemo, useState } from 'react';
import { renderSVG } from 'uqr';
import type { RoomClient } from '../connection/remote.ts';
import { Overlay } from '../game/Overlay.tsx';
import { MAX_SEATS } from '../home/modes.ts';
import { type Key, plural, presetText, t } from '../i18n/index.ts';
import { countChanges, RulesEditor } from '../rules/RulesEditor.tsx';
import { RulesPanel } from '../rules/RulesSummary.tsx';

// The room before a game (docs/SPEC.md §5.3): its code, link and QR code to bring the others in, the players and
// whether they are ready, the rules. The game master adds or removes bots, removes a player, edits the rules and
// starts; the others say they are ready. Everything shown is the server's last lobby; every button sends a message.
// Laid out for a full table (the owner's pick A on the 2026-11-21 canvas): the way in is one ticket (the code, the QR
// code as a thumbnail that opens large, «Inviter»), the players are tiles in a grid, and the button to start or to say
// «Prêt» stays in a bar pinned at the bottom of the screen.

const LEVEL_KEY: Record<BotLevel, Key> = { easy: 'levelEasy', medium: 'levelMedium', hard: 'levelHard' };

/** What a seat's tile says under the name: who leads, a bot's level, an absence, else whether they are ready. */
function statusOf(s: SeatInfo, gmId: string | null): string {
  if (s.id === gmId) return t('lobbyGm');
  if (s.kind === 'bot') return s.level ? t(LEVEL_KEY[s.level]) : t('lobbyBot');
  if (s.away) return t('presence_away');
  if (!s.connected) return t('presence_offline');
  return s.ready ? `✓ ${t('lobbyReady')}` : t('lobbyNotReady');
}

export function roomLink(code: string): string {
  const here = globalThis.location;
  return `${here.origin}${here.pathname}#room=${code}`;
}

interface Props {
  client: RoomClient;
  onLeave: () => void;
}

export function Lobby({ client, onLeave }: Props) {
  const lobby = client.lobby;
  const [level, setLevel] = useState<BotLevel>('medium');
  const [editing, setEditing] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState('');
  /** The QR code shown large, to be scanned. */
  const [qrBig, setQrBig] = useState(false);
  const link = roomLink(client.code);
  const qr = useMemo(() => renderSVG(link, { border: 2 }), [link]);
  if (!lobby) return null;

  const gm = client.isGameMaster;
  const me = lobby.seats.find((s) => s.id === client.seat);
  const rules = rulesOf(lobby.rules);
  const preset = PRESETS.find((p) => p.id === lobby.rules.preset);
  const changes = countChanges(lobby.rules.overrides);
  const everyoneReady = lobby.seats.every((s) => s.ready || s.away);
  const fits = tableFits(lobby.seats.length, rules);
  const canStart = lobby.seats.length >= 2 && everyoneReady && fits;

  const share = async () => {
    const text = t('lobbyShareText', { code: client.code });
    try {
      if (navigator.share) {
        await navigator.share({ title: t('appName'), text, url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Share sheet dismissed, or no clipboard: the code and the QR code are still on screen.
    }
  };

  const addBot = () => {
    const taken = new Set(lobby.seats.map((s) => s.name));
    const name = t('botNames')
      .split(',')
      .find((n) => !taken.has(n));
    client.send({ t: 'addBot', level, ...(name ? { name } : {}) });
  };

  if (editing && gm) {
    return (
      <RulesEditor
        choice={lobby.rules}
        onChange={(choice) => client.send({ t: 'setRules', choice })}
        onDone={() => setEditing(false)}
      />
    );
  }

  return (
    <main className="home lobby">
      <div className="lobby-bar">
        <button
          type="button"
          className="ghost"
          onClick={() => {
            if (window.confirm(t('confirmLeave'))) onLeave();
          }}
        >
          ← {t('lobbyLeave')}
        </button>
      </div>

      {/* The way in (the owner's pick A on the 2026-11-21 canvas): one ticket, the code in letters laid like cards,
          the QR code as a thumbnail that opens large, and one action to invite. */}
      <section className="ticket" aria-labelledby="ticket-title">
        <div className="ticket-body">
          <div className="ticket-main">
            <h2 id="ticket-title" className="ticket-kicker">
              {t('lobbyAccess')}
            </h2>
            <p className="ticket-code">
              <span aria-hidden="true">
                {[...client.code].map((ch, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: a code's letters may repeat; their place is their key
                  <span key={i} className="ticket-letter">
                    {ch}
                  </span>
                ))}
              </span>
              {/* Read letter by letter by a screen reader. */}
              <span className="sr-only">
                {t('onlineCode')} : {[...client.code].join(' ')}
              </span>
            </p>
            <p className="ticket-hint">{t('lobbyAccessHint')}</p>
          </div>
          <div className="ticket-qr">
            <button type="button" className="qr-thumb" aria-label={t('lobbyQrOpen')} onClick={() => setQrBig(true)}>
              {/* biome-ignore lint/security/noDangerouslySetInnerHtml: the SVG is generated locally from our own link */}
              <span className="qr" role="img" aria-label={t('lobbyQr')} dangerouslySetInnerHTML={{ __html: qr }} />
              <span className="qr-grow">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
                </svg>
              </span>
            </button>
            <span className="ticket-qr-label" aria-hidden="true">
              {t('lobbyQrGrow')}
            </span>
          </div>
        </div>
        <button type="button" className="ticket-invite" onClick={share}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3v12M7 8l5-5 5 5M5 14v5h14v-5" />
          </svg>
          {copied ? t('lobbyCopied') : t('lobbyInvite')}
        </button>
      </section>

      <section className="field" aria-labelledby="players-title">
        <h2 id="players-title" className="field-title">
          {t('lobbyPlayers', { n: lobby.seats.length, max: MAX_SEATS })}
        </h2>
        <ul className="lobby-seats">
          {lobby.seats.map((s, i) => (
            <li key={s.id} className={`${s.connected ? '' : 'offline'}${s.ready ? ' is-ready' : ''}`}>
              <span
                className="lobby-avatar"
                style={{ '--avatar': `var(--seat-${(i % 5) + 1})` } as CSSProperties}
                aria-hidden="true"
              >
                {s.name.slice(0, 1)}
              </span>
              <span className="seat-name">
                {s.name}
                {s.id === client.seat ? <span className="muted"> ({t('lobbyYou')})</span> : null}
              </span>
              <span className={s.ready ? 'ready on' : 'ready'}>{statusOf(s, lobby.gm)}</span>
              {gm && s.id !== client.seat ? (
                <button
                  type="button"
                  className="ghost"
                  aria-label={t('lobbyRemove', { name: s.name })}
                  onClick={() => client.send({ t: 'remove', seat: s.id })}
                >
                  ×
                </button>
              ) : null}
            </li>
          ))}
          {gm && lobby.seats.length < MAX_SEATS ? (
            <li className="lobby-add">
              <button type="button" aria-label={t('lobbyAddBot')} onClick={addBot}>
                <span aria-hidden="true">+ {t('lobbyBot')}</span>
                <small aria-hidden="true">{t(LEVEL_KEY[level])}</small>
              </button>
            </li>
          ) : null}
        </ul>
        {lobby.spectators > 0 ? <small className="muted">{plural('lobbySpectators', lobby.spectators)}</small> : null}
        {gm ? (
          <fieldset className="add-bot">
            <legend>{t('lobbyBotLevel')}</legend>
            <div className="segmented">
              {BOT_LEVELS.map((l) => (
                <label key={l} className={level === l ? 'on' : ''}>
                  <input type="radio" name="bot-level" checked={level === l} onChange={() => setLevel(l)} />
                  {t(LEVEL_KEY[l])}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
      </section>

      <section className="lobby-rules" aria-labelledby="rules-title-lobby">
        <p>
          <small id="rules-title-lobby">{t('lobbyRules')}</small>
          <b>
            {preset ? presetText(preset.id, preset).name : lobby.rules.preset}
            {changes > 0 ? ` · ${plural('editorModified', changes)}` : ''}
          </b>
        </p>
        <button type="button" className="ghost" onClick={() => (gm ? setEditing(true) : setShowRules(true))}>
          {gm ? t('lobbyRulesEdit') : t('lobbyRulesSee')}
        </button>
      </section>

      {me ? (
        gm ? (
          <div className="lobby-go">
            {!canStart ? (
              <p className="muted">
                {lobby.seats.length < 2
                  ? t('lobbyNeedTwo')
                  : !fits
                    ? t('needDecks', { n: lobby.seats.length })
                    : t('lobbyNeedReady')}
              </p>
            ) : null}
            <button
              type="button"
              className="btn btn-primary btn-big"
              disabled={!canStart}
              onClick={() => client.send({ t: 'start' })}
            >
              {t('lobbyStart')}
            </button>
          </div>
        ) : (
          <div className="lobby-go">
            <p className="muted">{t('lobbyWaitGm')}</p>
            <button
              type="button"
              className={`btn btn-big ${me.ready ? 'btn-secondary' : 'btn-primary'}`}
              onClick={() => client.send({ t: 'ready', ready: !me.ready })}
            >
              {me.ready ? t('lobbyNotReadyAnymore') : t('lobbyImReady')}
            </button>
          </div>
        )
      ) : (
        <form
          className="lobby-go"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) client.sit(name.trim());
          }}
        >
          <p className="muted">{t('lobbySpectator')}</p>
          {lobby.seats.length < MAX_SEATS ? (
            <>
              <label className="field">
                <span>{t('homeName')}</span>
                <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} autoComplete="nickname" />
              </label>
              <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
                {t('lobbySit')}
              </button>
            </>
          ) : null}
        </form>
      )}

      {qrBig ? (
        <Overlay labelledBy="qr-title" onClose={() => setQrBig(false)}>
          <div className="panel qr-sheet">
            <h2 id="qr-title">{t('lobbyQrTitle')}</h2>
            {/* biome-ignore lint/security/noDangerouslySetInnerHtml: the SVG is generated locally from our own link */}
            <div className="qr qr-big" role="img" aria-label={t('lobbyQr')} dangerouslySetInnerHTML={{ __html: qr }} />
            <p className="room-code mono" aria-hidden="true">
              {client.code}
            </p>
            <p className="muted">{t('lobbyAccessHint')}</p>
            <button type="button" className="btn btn-primary" onClick={() => setQrBig(false)} ref={(el) => el?.focus()}>
              {t('close')}
            </button>
          </div>
        </Overlay>
      ) : null}

      {showRules ? <RulesPanel rules={rules} onClose={() => setShowRules(false)} /> : null}
    </main>
  );
}
