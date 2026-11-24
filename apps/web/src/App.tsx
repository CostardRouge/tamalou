import { decodeRulesChoice, normalizeRoomCode, type RulesChoice, rulesOf } from '@tamalou/shared';
import { MotionConfig } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { trackEvent, trackView } from './audience.ts';
import { DeckStyleContext } from './cards/classic.tsx';
import { useHoloTilt } from './cards/tilt.ts';
import { LocalConnection } from './connection/local.ts';
import { serverMode } from './connection/remote.ts';
import type { GameConnection } from './connection/types.ts';
import { getSettings, useSettings } from './feedback/settings.ts';
import { GameScreen } from './game/GameScreen.tsx';
import { PACE_FACTOR } from './game/pace.ts';
import { choiceFor, type GameChoice, HomeScreen, playerName } from './home/HomeScreen.tsx';
import { MODE_DEFAULTS } from './home/modes.ts';
import { rememberedName } from './home/name.ts';
import { onLangChange, t } from './i18n/index.ts';
import { OnlineScreen } from './online/OnlineScreen.tsx';
import { rememberedAvatar } from './profile/avatar.ts';
import { applyUpdate, dismissUpdate, readShortcut, usePwa } from './pwa.ts';
import { reportUsage, setUsageAvailable, startGame } from './usage.ts';

export function newGame(c: GameChoice): GameConnection {
  const names = t('botNames').split(',');
  const humans = c.mode === 'solo' ? [c.name.trim() || t('homeNameDefault')] : c.players.map(playerName);
  // This device's avatar goes to its player: the solo one, or the one at a shared table who has its name.
  const owner = rememberedName().toLocaleLowerCase();
  const ownerAt = c.mode === 'solo' ? 0 : humans.findIndex((h) => h.trim().toLocaleLowerCase() === owner);
  const mine = rememberedAvatar();
  return new LocalConnection({
    humans,
    avatars: humans.map((_, i) => (i === ownerAt ? mine : null)),
    bots: Array.from({ length: c.bots }, (_, i) => ({ name: names[i] ?? t('botName', { n: i + 1 }), level: c.level })),
    rules: rulesOf({ preset: c.preset, overrides: c.overrides }, MODE_DEFAULTS[c.mode]),
    botPace: PACE_FACTOR[getSettings().botPace],
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

/**
 * The room an address names (`#room=ABCDE`): kept in the address while in the room, so a reload comes back. The QR
 * code's link adds `&via=qr`, read once for the usage statistics (how people come in) and dropped from the address.
 */
function roomFromLink(): { code: string; via: 'qr' | 'link' } | null {
  const m = /^#room=([\w-]+)(&via=qr)?$/.exec(globalThis.location?.hash ?? '');
  const code = m?.[1] ? normalizeRoomCode(m[1]) : null;
  if (!code) return null;
  if (m?.[2]) setRoomLink(code);
  return { code, via: m?.[2] ? 'qr' : 'link' };
}

function setRoomLink(code: string | null) {
  history.replaceState(null, '', location.pathname + location.search + (code ? `#room=${code}` : ''));
}

export function App() {
  const [game, setGame] = useState<Game | null>(null);
  const [linked] = useState(rulesFromLink);
  // The icon's shortcut that opened the game, if any (ADR-0020): "Partie solo" deals at once with the remembered
  // setup, "À plusieurs" opens the home screen on pass-and-play.
  const [shortcut] = useState(readShortcut);
  const [room, setRoom] = useState<{ code: string; name?: string; via?: 'qr' | 'link' } | null>(roomFromLink);
  const [online, setOnline] = useState(false);
  // A language change draws everything again; games and rooms keep going.
  const [, setLang] = useState('');
  useEffect(() => onLangChange(setLang), []);
  const { updateReady } = usePwa();
  useEffect(() => {
    let live = true;
    serverMode().then((mode) => {
      // Usage statistics go to the online server only (ADR-0024): the LAN version counts nothing.
      setUsageAvailable(mode === 'online');
      if (live) setOnline(mode !== null);
    });
    return () => {
      live = false;
    };
  }, []);
  const enterRoom = useCallback((code: string, name?: string, made = false) => {
    setRoomLink(code);
    setRoom(name ? { code, name } : { code });
    if (name) reportUsage({ kind: 'roomJoined', via: made ? 'created' : 'code' });
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
    (choice: GameChoice) => {
      replace({ id: Date.now(), conn: newGame(choice), choice });
      const humans = choice.mode === 'solo' ? 1 : choice.players.length;
      startGame(
        {
          mode: choice.mode === 'pass' ? 'pass' : 'solo',
          players: humans + choice.bots,
          humans,
          bots: choice.bots,
          level: choice.bots > 0 ? choice.level : null,
          preset: choice.preset,
          rulesChanged: Object.keys(choice.overrides).length > 0,
        },
        true,
      );
      trackEvent('game-started', {
        mode: choice.mode,
        bots: choice.bots,
        level: choice.level,
        preset: choice.preset,
        custom: Object.keys(choice.overrides).length > 0,
      });
    },
    [replace],
  );
  // One view per screen, never a room's code (ADR-0018): the game's home, a local game, a room.
  const screen = room ? 'room' : game ? 'game' : '';
  useEffect(() => trackView(`/play/${screen}`), [screen]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, on arrival (the shortcut left the address when read)
  useEffect(() => {
    if (shortcut === 'solo' && !room) play(choiceFor('solo'));
  }, []);

  // The player's cards (cards/deck.ts): every card on every screen is drawn in this style.
  const deck = useSettings().deck;
  useHoloTilt(deck.effect !== 'none');

  return (
    // Animations follow the system's "reduce motion" setting.
    <MotionConfig reducedMotion="user">
      <DeckStyleContext.Provider value={deck}>
        {updateReady && !game && !room ? (
          <p className="banner update" role="status">
            <span>{t('updateReady')}</span>
            <button type="button" className="link" onClick={applyUpdate}>
              {t('updateReload')}
            </button>
            <button type="button" className="link muted" onClick={dismissUpdate}>
              {t('updateLater')}
            </button>
          </p>
        ) : null}
        {room ? (
          <OnlineScreen
            key={room.code}
            code={room.code}
            {...(room.name ? { name: room.name } : {})}
            {...(room.via ? { via: room.via } : {})}
            onExit={exitRoom}
          />
        ) : game ? (
          <GameScreen key={game.id} conn={game.conn} onQuit={() => replace(null)} onReplay={() => play(game.choice)} />
        ) : (
          <HomeScreen
            onPlay={play}
            linked={linked}
            online={online}
            onRoom={enterRoom}
            {...(shortcut === 'pass' ? { mode: 'pass' as const } : {})}
          />
        )}
      </DeckStyleContext.Provider>
    </MotionConfig>
  );
}
