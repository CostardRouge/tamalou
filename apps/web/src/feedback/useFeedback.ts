import type { GameEvent, PlayerId } from '@tamalou/shared';
import { useEffect, useRef, useState } from 'react';
import { strongestCue, touchedSlots } from './cues.ts';
import { getSettings } from './settings.ts';
import { play, vibrate } from './sound.ts';

// Plays the sound and the vibration of what just happened, flashes the slots a move touched, and raises the
// "Tamalou !" splash when someone calls. Only events that arrive while the screen is open count: opening a game
// (or coming back to an online room with its whole log) is silent.

export interface Feedback {
  /** `player:slot` keys to flash. */
  flash: ReadonlySet<string>;
  /** Who just called Tamalou, while the splash shows. */
  splash: PlayerId | null;
}

const FLASH_MS = 900;
const SPLASH_MS = 1600;

export function useFeedback(events: readonly GameEvent[], me: PlayerId): Feedback {
  const seen = useRef(events.length);
  const [flash, setFlash] = useState<ReadonlySet<string>>(new Set());
  const [splash, setSplash] = useState<PlayerId | null>(null);
  // Timers live in a ref: the effect below runs after every render, and its own cleanup would cancel them.
  const timers = useRef<{ flash?: ReturnType<typeof setTimeout>; splash?: ReturnType<typeof setTimeout> }>({});
  useEffect(
    () => () => {
      clearTimeout(timers.current.flash);
      clearTimeout(timers.current.splash);
    },
    [],
  );

  useEffect(() => {
    // A log that was replaced (a new game in the same room) starts again from its end.
    if (events.length < seen.current) seen.current = events.length;
    const fresh = events.slice(seen.current);
    seen.current = events.length;
    if (fresh.length === 0) return;
    const settings = getSettings();
    const hit = strongestCue(fresh, me);
    if (hit) {
      if (settings.sound) play(hit.cue);
      if (settings.haptics && hit.mine) vibrate(hit.cue);
    }
    const touched = touchedSlots(fresh);
    if (touched.length > 0) {
      setFlash(new Set(touched));
      clearTimeout(timers.current.flash);
      timers.current.flash = setTimeout(() => setFlash(new Set()), FLASH_MS);
    }
    const call = fresh.find((e) => e.type === 'tamalouCalled');
    if (call?.type === 'tamalouCalled') {
      setSplash(call.player);
      clearTimeout(timers.current.splash);
      timers.current.splash = setTimeout(() => setSplash(null), SPLASH_MS);
    }
  });

  return { flash, splash };
}
