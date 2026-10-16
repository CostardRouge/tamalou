import { useEffect, useMemo, useReducer, useState } from 'react';
import { RemoteConnection, RoomClient, type SocketFactory, savedToken } from '../connection/remote.ts';
import { GameScreen } from '../game/GameScreen.tsx';
import { type Key, t } from '../i18n/index.ts';
import { Lobby } from './Lobby.tsx';

// A room, from arriving to leaving: a name to sit down when this device has no seat there yet, then the lobby, the
// game, and back to the lobby when the game master replays. A lost connection shows a banner while the client
// reconnects on its own; a closed room says why and leads home.

interface Props {
  code: string;
  /** The name typed on the home screen (creating or joining from there). */
  name?: string;
  onExit: () => void;
  /** Tests hand in fake sockets. */
  socket?: SocketFactory;
}

export function OnlineScreen({ code, name, onExit, socket }: Props) {
  const [joining, setJoining] = useState<{ name?: string; spectate?: boolean } | null>(() =>
    name || savedToken(code) ? (name ? { name } : {}) : null,
  );
  if (!joining) return <JoinForm code={code} onJoin={setJoining} onExit={onExit} />;
  return <Room code={code} joining={joining} onExit={onExit} socket={socket} />;
}

function Room({
  code,
  joining,
  onExit,
  socket,
}: {
  code: string;
  joining: { name?: string; spectate?: boolean };
  onExit: () => void;
  socket?: SocketFactory | undefined;
}) {
  // One client for the screen's life, made in an effect: StrictMode's extra mount disposes its own before it opens.
  const [client, setClient] = useState<RoomClient | null>(null);
  const [, bump] = useReducer((x: number) => x + 1, 0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: one client per room code
  useEffect(() => {
    const c = new RoomClient({ code, ...joining }, socket);
    const off = c.subscribe(bump);
    setClient(c);
    return () => {
      off();
      c.dispose();
    };
  }, [code]);
  const conn = useMemo(() => (client ? new RemoteConnection(client) : null), [client]);
  // A refusal shows for a few seconds.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!client?.refused) return;
    const left = client.refused.at + 3000 - Date.now();
    if (left <= 0) return;
    const id = setTimeout(() => setNow(Date.now()), left);
    return () => clearTimeout(id);
  });

  if (!client || !conn) return null;

  const leave = () => {
    client.leave();
    onExit();
  };

  if (client.status === 'closed') {
    return (
      <main className="home center-screen">
        <h1>{t('onlineJoinTitle', { code })}</h1>
        <p className="notice">{t(`closed_${client.closedReason ?? 'notFound'}` as Key)}</p>
        <button type="button" className="btn btn-primary" onClick={onExit} ref={(el) => el?.focus()}>
          {t('actHome')}
        </button>
      </main>
    );
  }
  if (!client.lobby) {
    return (
      <main className="home center-screen">
        <p className="muted" aria-live="polite">
          {client.status === 'reconnecting' ? t('onlineReconnecting') : t('onlineConnecting')}
        </p>
        <button type="button" className="btn btn-secondary" onClick={onExit}>
          {t('actHome')}
        </button>
      </main>
    );
  }

  // A second tap on a draw already waiting for the window is harmless: no notice for it.
  const refused =
    client.refused && client.refused.at + 3000 > now && client.refused.error !== 'alreadyDrawing'
      ? client.refused
      : null;
  const banner =
    client.status === 'reconnecting' ? (
      <p className="banner" role="status">
        {t('onlineReconnecting')}
      </p>
    ) : refused?.about === 'action' ? (
      <p className="banner" role="status">
        {t(refused.error === 'staleTop' ? 'refused_staleTop' : 'refused_other')}
      </p>
    ) : client.seat === null ? (
      <p className="banner">{t('watching')}</p>
    ) : null;

  if (client.lobby.phase === 'lobby' || !client.game) {
    return (
      <>
        {client.status === 'reconnecting' ? banner : null}
        <Lobby client={client} onLeave={leave} />
      </>
    );
  }
  return (
    <GameScreen
      key={client.lobby.phase === 'playing' ? 'game' : 'over'}
      conn={conn}
      banner={banner}
      onQuit={leave}
      onReplay={client.isGameMaster ? () => client.send({ t: 'replay' }) : undefined}
    />
  );
}

function JoinForm({
  code,
  onJoin,
  onExit,
}: {
  code: string;
  onJoin: (j: { name?: string; spectate?: boolean }) => void;
  onExit: () => void;
}) {
  const [name, setName] = useState('');
  return (
    <main className="home">
      <div className="brand">
        <h1>{t('appName')}</h1>
        <p className="tagline">{t('onlineJoinTitle', { code })}</p>
      </div>
      <form
        className="setup"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onJoin({ name: name.trim() });
        }}
      >
        <p className="muted">{t('onlineJoinHint')}</p>
        <label className="field">
          <span>{t('homeName')}</span>
          <input value={name} maxLength={20} autoComplete="nickname" onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="submit" className="btn btn-primary btn-big" disabled={!name.trim()}>
          {t('onlineJoin')}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => onJoin({ spectate: true })}>
          {t('onlineWatch')}
        </button>
        <button type="button" className="ghost" onClick={onExit}>
          ← {t('actHome')}
        </button>
      </form>
    </main>
  );
}
