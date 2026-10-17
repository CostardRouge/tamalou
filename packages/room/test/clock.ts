import type { Scheduler } from '../src/index.ts';

/** A clock moved by hand: timers fire in order when time is advanced. */
export class FakeClock implements Scheduler {
  private t = 0;
  private seq = 0;
  private timers = new Map<number, { at: number; fn: () => void }>();
  now() {
    return this.t;
  }
  setTimeout(fn: () => void, ms: number) {
    const id = ++this.seq;
    this.timers.set(id, { at: this.t + ms, fn });
    return id;
  }
  clearTimeout(h: unknown) {
    this.timers.delete(h as number);
  }
  /** Runs every timer due within `ms`, in time order, including ones set while running. */
  advance(ms: number) {
    const end = this.t + ms;
    for (;;) {
      let next: [number, { at: number; fn: () => void }] | undefined;
      for (const e of this.timers) if (e[1].at <= end && (!next || e[1].at < next[1].at)) next = e;
      if (!next) break;
      this.timers.delete(next[0]);
      this.t = next[1].at;
      next[1].fn();
    }
    this.t = end;
  }
  pending() {
    return this.timers.size;
  }
}
