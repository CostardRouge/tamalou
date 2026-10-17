import { animate, motion, useMotionValue, useSpring } from 'motion/react';
import { type ReactNode, useRef } from 'react';
import { type Box, MY_ZONE } from './drag.ts';
import type { Place } from './flights.ts';

// A card that can be picked up by hand (design D, "physique souple"): it follows the finger, leans into its motion
// on a soft spring, and on release either goes on (the move is accepted: it lets the flight take over from where it
// was let go) or springs back to its place. Without `enabled` it is just its child: taps and keys work as before.

const BACK = { type: 'spring' as const, stiffness: 260, damping: 17 };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface Props {
  enabled: boolean;
  onPick: () => void;
  onMove: (point: { x: number; y: number }) => void;
  /** True when the drop was taken: the card does not come back. */
  onRelease: (point: { x: number; y: number }, velocity: { x: number; y: number }, box: Box) => boolean;
  children: ReactNode;
}

export function Draggable({ enabled, onPick, onMove, onRelease, children }: Props) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useSpring(0, { stiffness: 320, damping: 18 });
  const el = useRef<HTMLDivElement>(null);
  if (!enabled) return <>{children}</>;
  return (
    <motion.div
      ref={el}
      className="draggable"
      style={{ x, y, rotate }}
      drag
      dragMomentum={false}
      dragElastic={1}
      whileDrag={{ scale: 1.1, zIndex: 40 }}
      onDragStart={onPick}
      onDrag={(_, info) => {
        rotate.set(clamp(info.velocity.x * 0.02, -16, 16));
        onMove(info.point);
      }}
      onDragEnd={(_, info) => {
        rotate.set(0);
        const r = el.current?.getBoundingClientRect();
        const box = r
          ? { x: r.left, y: r.top, w: r.width, h: r.height }
          : { x: info.point.x, y: info.point.y, w: 0, h: 0 };
        if (onRelease(info.point, info.velocity, box)) {
          x.jump(0);
          y.jump(0);
        } else {
          animate(x, 0, BACK);
          animate(y, 0, BACK);
        }
      }}
    >
      {children}
    </motion.div>
  );
}

/** Where every place of the table is now, and my grid's box as the place to drop a card drawn "to me". */
export function measurePlaces(): Map<Place, Box> {
  const out = new Map<Place, Box>();
  const box = (el: Element): Box => {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  };
  for (const el of document.querySelectorAll<HTMLElement>('[data-place]')) out.set(el.dataset.place as Place, box(el));
  const zone = document.querySelector('[data-zone="mine"]');
  if (zone) out.set(MY_ZONE, box(zone));
  return out;
}
