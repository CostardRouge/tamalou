// The name this device plays under, kept on the device (the owner, 2026-11-21: a friend coming back to a room should
// not type their name again). The home screen keeps it with the last setup; a room joined by link, or a seat taken
// from the watchers, keeps it here too, so every way into a game starts with it filled in. Nothing leaves the device.

const KEY = 'tamalou-name';

export function rememberedName(): string {
  try {
    return (globalThis.localStorage?.getItem(KEY) ?? '').slice(0, 20);
  } catch {
    return '';
  }
}

export function rememberName(name: string): void {
  const kept = name.trim().slice(0, 20);
  if (!kept) return;
  try {
    globalThis.localStorage?.setItem(KEY, kept);
  } catch {
    // Storage refused: the name is typed again next time, nothing breaks.
  }
}
