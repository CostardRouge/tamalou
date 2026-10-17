import type { Scheduler } from './table.ts';

/** The real clock, for the browser and the servers; tests inject a fake one. */
export const systemClock: Scheduler = {
  now: () => performance.now(),
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>),
};
