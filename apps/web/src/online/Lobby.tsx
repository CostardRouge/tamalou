import { BOT_LEVELS, type BotLevel } from '@tamalou/bots';
import { PRESETS, rulesOf } from '@tamalou/shared';
import { useMemo, useState } from 'react';
import { renderSVG } from 'uqr';
import type { RoomClient } from '../connection/remote.ts';
import { MAX_SEATS } from '../home/modes.ts';
import { type Key, plural, t } from '../i18n/index.ts';
import { countChanges, RulesEditor } from '../rules/RulesEditor.tsx';
import { RulesPanel } from '../rules/RulesSummary.tsx';

// The room before a game (docs/SPEC.md §5.3): its code, link and QR code to bring the others in, the players and
// whether they are ready, the rules. The game master adds or removes bots, removes a player, edits the rules and
// starts; the others say they are ready. Everything shown is the server's last lobby; every button sends a message.

const LEVEL_KEY: Record<BotLevel, Key> = { easy: 'levelEasy', medium: 'levelMedium', hard: 'levelHard' };

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
  const link = roomLink(client.code);
  const qr = useMemo(() => renderSVG(link, { border: 2 }), [link]);
  if (!lobby) return null;

  const gm = client.isGameMaster;
  const me = lobby.seats.find((s) => s.id === client.seat);
  const rules = rulesOf(lobby.rules);
  const preset = PRESETS.find((p) => p.id === lobby.rules.preset);
  const changes = countChanges(lobby.rules.overrides);
  const everyoneReady = lobby.seats.every((s) => s.ready || s.away);
  const canStart = lobby.seats.length >= 2 && everyoneReady;

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

      <section className="room-card" aria-labelledby="room-code">
        <span className="muted">{t('onlineCode')}</span>
        <p id="room-code" className="room-code mono">
          {/* Read letter by letter by a screen reader. */}
          <span aria-hidden="true">{client.code}</span>
          <span className="sr-only">{[...client.code].join(' ')}</span>
        </p>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: the SVG is generated locally from our own link */}
        <div className="qr" role="img" aria-label={t('lobbyQr')} dangerouslySetInnerHTML={{ __html: qr }} />
        <button type="button" className="btn btn-secondary" onClick={share}>
          {copied ? t('lobbyCopied') : t('lobbyShare')}
        </button>
      </section>

      <section className="field" aria-labelledby="players-title">
        <h2 id="players-title" className="field-title">
          {t('lobbyPlayers', { n: lobby.seats.length })}
        </h2>
        <ul className="lobby-seats">
          {lobby.seats.map((s) => (
            <li key={s.id} className={s.connected ? '' : 'offline'}>
              <span className="seat-name">
                {s.name}
                {s.id === client.seat ? <span className="muted"> ({t('lobbyYou')})</span> : null}
              </span>
              <span className="seat-tags">
                {s.id === lobby.gm ? <span className="badge">{t('lobbyGm')}</span> : null}
                {s.kind === 'bot' && s.level ? <span className="tag">{t(LEVEL_KEY[s.level])}</span> : null}
                {s.kind === 'human' && s.away ? <span className="tag">{t('presence_away')}</span> : null}
                {s.kind === 'human' && !s.connected && !s.away ? (
                  <span className="tag">{t('presence_offline')}</span>
                ) : null}
                <span className={s.ready ? 'ready on' : 'ready'}>
                  {s.ready ? `✓ ${t('lobbyReady')}` : t('lobbyNotReady')}
                </span>
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
              </span>
            </li>
          ))}
        </ul>
        {lobby.spectators > 0 ? <small className="muted">{plural('lobbySpectators', lobby.spectators)}</small> : null}
        {gm ? (
          <div className="add-bot">
            <div className="segmented">
              {BOT_LEVELS.map((l) => (
                <label key={l} className={level === l ? 'on' : ''}>
                  <input type="radio" name="bot-level" checked={level === l} onChange={() => setLevel(l)} />
                  {t(LEVEL_KEY[l])}
                </label>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={lobby.seats.length >= MAX_SEATS}
              onClick={addBot}
            >
              {t('lobbyAddBot')}
            </button>
          </div>
        ) : null}
      </section>

      <section className="field" aria-labelledby="rules-title-lobby">
        <h2 id="rules-title-lobby" className="field-title">
          {t('lobbyRules')}
        </h2>
        <p>
          <b>{preset?.name ?? lobby.rules.preset}</b>
          {changes > 0 ? <span className="tag">{plural('editorModified', changes)}</span> : null}
        </p>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => (gm ? setEditing(true) : setShowRules(true))}
        >
          {gm ? t('lobbyRulesEdit') : t('lobbyRulesSee')}
        </button>
      </section>

      {me ? (
        gm ? (
          <div className="lobby-go">
            {!canStart ? (
              <p className="muted">{lobby.seats.length < 2 ? t('lobbyNeedTwo') : t('lobbyNeedReady')}</p>
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

      {showRules ? <RulesPanel rules={rules} onClose={() => setShowRules(false)} /> : null}
    </main>
  );
}
