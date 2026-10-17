// A seeded generator (mulberry32) whose state lives in the game state, so a game replays from its seed and its
// actions alone. Never Math.random() in the engine.

/** Returns a float in [0, 1) and the next generator state. */
export function nextRandom(state: number): [number, number] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

/** Fisher–Yates in place, advancing the holder's rng. */
export function shuffleInPlace<T>(items: T[], holder: { rng: number }): void {
  for (let i = items.length - 1; i > 0; i--) {
    const [r, next] = nextRandom(holder.rng);
    holder.rng = next;
    const j = Math.floor(r * (i + 1));
    const a = items[i] as T;
    items[i] = items[j] as T;
    items[j] = a;
  }
}

/** A 32-bit seed from any string, for seeds typed by people or carried in a link. */
export function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
