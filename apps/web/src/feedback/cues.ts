import type { GameEvent, PlayerId } from '@tamalou/shared';
import type { Cue } from './sound.ts';

// What the game sounds and feels like: events in, cues out. Pure, so it is tested without a browser.

const PRIORITY: Cue[] = ['win', 'tamalou', 'fail', 'quick', 'round', 'yourTurn', 'peek', 'place', 'draw'];

/** Whether a cue concerns this player (vibrations are kept for what is about them). */
export interface CueHit {
  cue: Cue;
  mine: boolean;
}

export function cueOf(e: GameEvent, me: PlayerId): CueHit | null {
  switch (e.type) {
    case 'turnStarted':
      return e.player === me ? { cue: 'yourTurn', mine: true } : null;
    case 'drew':
      return { cue: 'draw', mine: e.player === me };
    case 'swapped':
    case 'discarded':
    case 'cardsSwapped':
      return { cue: 'place', mine: e.player === me };
    case 'peeked':
      return { cue: 'peek', mine: true };
    case 'quickDiscard':
      return { cue: 'quick', mine: e.player === me || e.target.player === me };
    case 'quickDiscardFailed':
      return { cue: 'fail', mine: e.player === me };
    case 'tamalouCalled':
      return { cue: 'tamalou', mine: true };
    case 'roundEnded':
      return { cue: 'round', mine: false };
    case 'gameEnded':
      return e.winners.includes(me) ? { cue: 'win', mine: true } : { cue: 'round', mine: false };
    default:
      return null;
  }
}

/** Of a batch of new events (bots can play several at once), the one cue worth playing. */
export function strongestCue(events: readonly GameEvent[], me: PlayerId): CueHit | null {
  let best: CueHit | null = null;
  for (const e of events) {
    const hit = cueOf(e, me);
    if (hit && (!best || PRIORITY.indexOf(hit.cue) < PRIORITY.indexOf(best.cue))) best = hit;
  }
  return best;
}

/** Slots an event just touched, as `player:slot`: the table flashes them so a move is easy to follow. */
export function touchedSlots(events: readonly GameEvent[]): string[] {
  const out: string[] = [];
  for (const e of events) {
    if (e.type === 'swapped') out.push(`${e.player}:${e.slot}`);
    if (e.type === 'cardsSwapped') out.push(`${e.a.player}:${e.a.slot}`, `${e.b.player}:${e.b.slot}`);
    if (e.type === 'quickDiscard' || e.type === 'quickDiscardFailed') out.push(`${e.target.player}:${e.target.slot}`);
    if (e.type === 'powerUsed') for (const t of e.targets) out.push(`${t.player}:${t.slot}`);
  }
  return out;
}
