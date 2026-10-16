// Short sounds synthesised with WebAudio: no audio file to download, cache or license. Each cue is a few enveloped
// oscillator notes, quiet on purpose (a card game is played with others around). Browsers only let a page make sound
// after a tap, so the context is created, or resumed, on the first pointer event.

export type Cue = 'yourTurn' | 'draw' | 'place' | 'peek' | 'quick' | 'fail' | 'tamalou' | 'round' | 'win';

type Note = { f: number; at: number; len: number; type?: OscillatorType; gain?: number };

const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;

const CUES: Record<Cue, Note[]> = {
  yourTurn: [
    { f: G5, at: 0, len: 0.12 },
    { f: C6, at: 0.1, len: 0.18 },
  ],
  draw: [{ f: 320, at: 0, len: 0.06, type: 'triangle', gain: 0.5 }],
  place: [{ f: 220, at: 0, len: 0.07, type: 'triangle', gain: 0.6 }],
  peek: [{ f: 880, at: 0, len: 0.08, gain: 0.4 }],
  quick: [
    { f: E5, at: 0, len: 0.1 },
    { f: G5, at: 0.07, len: 0.1 },
    { f: C6, at: 0.14, len: 0.2 },
  ],
  fail: [
    { f: 180, at: 0, len: 0.16, type: 'square', gain: 0.35 },
    { f: 140, at: 0.14, len: 0.22, type: 'square', gain: 0.35 },
  ],
  tamalou: [
    { f: C5, at: 0, len: 0.14, type: 'triangle' },
    { f: G5, at: 0.12, len: 0.14, type: 'triangle' },
    { f: C6, at: 0.24, len: 0.32, type: 'triangle' },
  ],
  round: [
    { f: G5, at: 0, len: 0.12 },
    { f: E5, at: 0.1, len: 0.12 },
    { f: C5, at: 0.2, len: 0.24 },
  ],
  win: [
    { f: C5, at: 0, len: 0.12 },
    { f: E5, at: 0.1, len: 0.12 },
    { f: G5, at: 0.2, len: 0.12 },
    { f: C6, at: 0.3, len: 0.4 },
  ],
};

const VOLUME = 0.12;
let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor =
    globalThis.AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  return ctx;
}

/** Called once: the first tap anywhere opens (or wakes) the audio context. */
export function unlockAudioOnFirstTap(): void {
  const unlock = () => {
    void context()?.resume();
  };
  globalThis.addEventListener?.('pointerdown', unlock, { passive: true });
  globalThis.addEventListener?.('keydown', unlock);
}

export function play(cue: Cue): void {
  const ac = context();
  if (ac?.state !== 'running') return;
  const start = ac.currentTime + 0.01;
  for (const n of CUES[cue]) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = n.type ?? 'sine';
    osc.frequency.value = n.f;
    const peak = VOLUME * (n.gain ?? 1);
    const t0 = start + n.at;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.len);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + n.len + 0.02);
  }
}

const VIBRATIONS: Partial<Record<Cue, number | number[]>> = {
  yourTurn: 30,
  quick: [20, 40, 20],
  fail: 180,
  tamalou: [60, 60, 60],
  win: [40, 60, 40, 60, 120],
};

export function vibrate(cue: Cue): void {
  const pattern = VIBRATIONS[cue];
  if (pattern !== undefined) globalThis.navigator?.vibrate?.(pattern);
}
