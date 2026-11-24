import { useEffect } from 'react';

// The iridescent and holographic effects move with the light (deck.ts): the pointer on a computer, the phone's tilt where
// the browser gives it without asking (Android; iPhone asks a permission, so the foil just drifts there). Two variables
// on the page, --tilt-x and --tilt-y in [-1, 1], read by cards.css; nothing when the effect is off or motion reduced.

export function useHoloTilt(on: boolean): void {
  useEffect(() => {
    if (!on || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const root = document.documentElement;
    let frame = 0;
    let x = 0;
    let y = 0;
    const apply = () => {
      frame = 0;
      root.style.setProperty('--tilt-x', x.toFixed(3));
      root.style.setProperty('--tilt-y', y.toFixed(3));
    };
    const set = (nx: number, ny: number) => {
      x = Math.max(-1, Math.min(1, nx));
      y = Math.max(-1, Math.min(1, ny));
      frame ||= requestAnimationFrame(apply);
    };
    const pointer = (e: PointerEvent) => set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
    const tilt = (e: DeviceOrientationEvent) => {
      if (e.gamma === null || e.beta === null) return;
      set(e.gamma / 35, (e.beta - 45) / 35);
    };
    addEventListener('pointermove', pointer, { passive: true });
    const asks =
      typeof (globalThis.DeviceOrientationEvent as { requestPermission?: unknown } | undefined)?.requestPermission ===
      'function';
    if (!asks) addEventListener('deviceorientation', tilt);
    return () => {
      removeEventListener('pointermove', pointer);
      removeEventListener('deviceorientation', tilt);
      if (frame) cancelAnimationFrame(frame);
      root.style.removeProperty('--tilt-x');
      root.style.removeProperty('--tilt-y');
    };
  }, [on]);
}
