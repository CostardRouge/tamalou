import { rulesFromPreset } from '@tamalou/shared';
import { MotionConfig } from 'motion/react';
import { useCallback, useState } from 'react';
import { LocalConnection } from './connection/local.ts';
import type { GameConnection } from './connection/types.ts';
import { GameScreen } from './game/GameScreen.tsx';
import { HomeScreen, type SoloChoice } from './home/HomeScreen.tsx';
import { t } from './i18n/index.ts';

export function newSoloGame(c: SoloChoice): GameConnection {
  const names = t('botNames').split(',');
  return new LocalConnection({
    name: c.name.trim() || t('homeNameDefault'),
    bots: Array.from({ length: c.bots }, (_, i) => ({ name: names[i] ?? t('botName', { n: i + 1 }), level: c.level })),
    rules: rulesFromPreset(c.preset),
  });
}

interface Game {
  id: number;
  conn: GameConnection;
  choice: SoloChoice;
}

export function App() {
  const [game, setGame] = useState<Game | null>(null);

  // The previous table is stopped when it is replaced, not in an effect: StrictMode runs effects twice in development,
  // and a cleanup there would stop the game that is still on screen.
  const replace = useCallback((next: Game | null) => {
    setGame((prev) => {
      prev?.conn.dispose();
      return next;
    });
  }, []);
  const play = useCallback(
    (choice: SoloChoice) => replace({ id: Date.now(), conn: newSoloGame(choice), choice }),
    [replace],
  );

  return (
    // Animations follow the system's "reduce motion" setting.
    <MotionConfig reducedMotion="user">
      {game ? (
        <GameScreen key={game.id} conn={game.conn} onQuit={() => replace(null)} onReplay={() => play(game.choice)} />
      ) : (
        <HomeScreen onPlay={play} />
      )}
    </MotionConfig>
  );
}
