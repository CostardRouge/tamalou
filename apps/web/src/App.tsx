import { decodeRulesChoice, normalizeRoomCode, type RulesChoice, rulesOf } from '@tamalou/shared';
import { MotionConfig } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { LocalConnection } from './connection/local.ts';
import { roomsAvailable } from './connection/remote.ts';
import type { GameConnection } from './connection/types.ts';
import { GameScreen } from './game/GameScreen.tsx';
import { type GameChoice, HomeScreen, playerName } from './home/HomeScreen.tsx';
import { MODE_DEFAULTS } from './home/modes.ts';
import { t } from './i18n/index.ts';
import { OnlineScreen } from './online/OnlineScreen.tsx';

export function newGame(c: GameChoice): GameConnection {
  const names = t('botNames').split(',');
  return new LocalConnection({
    humans: c.mode === 'solo' ? [c.name.trim() || t('homeNameDefault')] : c.players.map(playerName),
    bots: Array.from({ length: c.bots }, (_, i) => ({ name: names[i] ?? t('botName', { n: i + 1 }), level: c.level })),
    rules: rulesOf({ preset: c.preset, overrides: c.overrides }, MODE_DEFAULTS[c.mode]),
  });
}

interface Game {
  id: number;
  conn: GameConnection;
  choice: GameChoice;
}

/** Rules carried by a shared link (`#rules=…`), read once; the fragment is then dropped from the address. */
function rulesFromLink(): RulesChoice | null {
  const m = /^#rules=([\w-]+)$/.exec(globalThis.location?.hash ?? '');
  if (!m?.[1]) return null;
  history.replaceState(null, '', location.pathname + location.search);
  return decodeRulesChoice(m[1]);
}

/** The room an address names (`#room=ABCDE`): kept in the address while in the room, so a reload comes back. */
function roomFromLink(): string | null {
  const m = /^#room=([\w-]+)$/.exec(globalThis.location?.hash ?? '');
  return m?.[1] ? normalizeRoomCode(m[1]) : null;
}

function setRoomLink(code: string | null) {
  history.replaceState(null, '', location.pathname + location.search + (code ? `#room=${code}` : ''));
}

export function App() {
  const [game, setGame] = useState<Game | null>(null);
  const [linked] = useState(rulesFromLink);
  const [room, setRoom] = useState<{ code: string; name?: string } | null>(() => {
    const code = roomFromLink();
    return code ? { code } : null;
  });
  const [online, setOnline] = useState(false);
  useEffect(() => {
    let live = true;
    roomsAvailable().then((ok) => live && setOnline(ok));
    return () => {
      live = false;
    };
  }, []);
  const enterRoom = useCallback((code: string, name?: string) => {
    setRoomLink(code);
    setRoom(name ? { code, name } : { code });
  }, []);
  const exitRoom = useCallback(() => {
    setRoomLink(null);
    setRoom(null);
  }, []);

  // The previous table is stopped when it is replaced, not in an effect: StrictMode runs effects twice in development,
  // and a cleanup there would stop the game that is still on screen.
  const replace = useCallback((next: Game | null) => {
    setGame((prev) => {
      prev?.conn.dispose();
      return next;
    });
  }, []);
  const play = useCallback(
    (choice: GameChoice) => replace({ id: Date.now(), conn: newGame(choice), choice }),
    [replace],
  );

  return (
    // Animations follow the system's "reduce motion" setting.
    <MotionConfig reducedMotion="user">
      {room ? (
        <OnlineScreen key={room.code} code={room.code} {...(room.name ? { name: room.name } : {})} onExit={exitRoom} />
      ) : game ? (
        <GameScreen key={game.id} conn={game.conn} onQuit={() => replace(null)} onReplay={() => play(game.choice)} />
      ) : (
        <HomeScreen onPlay={play} linked={linked} online={online} onRoom={enterRoom} />
      )}
    </MotionConfig>
  );
}
