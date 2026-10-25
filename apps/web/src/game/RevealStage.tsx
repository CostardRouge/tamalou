import type { Card } from '@tamalou/shared';
import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { CardView } from '../cards/CardView.tsx';

// A card a power lets me look at (the owner, 2026-10-25: in an arc an opponent's card is tiny and half under its
// neighbours): it rises from its place, turns over in 3D and stays large in front of me with whose card it is, while
// the action bar below says what to do next. Nothing to tap here: the bar ends the look.

interface Props {
  card: Card;
  /** Where it lies on the table (`slot:<player>:<slot>`), to rise from. */
  place: string;
  /** Whose card it is: "Carte 2 de Ada", "Ta carte 3". */
  caption: string;
}

export function RevealStage({ card, place, caption }: Props) {
  const reduced = useReducedMotion();
  // Measured once, when the look starts: the card leaves from where it lies.
  const [from] = useState(() => {
    const el = document.querySelector(`[data-place="${CSS.escape(place)}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      x: r.left + r.width / 2 - window.innerWidth / 2,
      y: r.top + r.height / 2 - window.innerHeight * 0.42,
      w: r.width,
    };
  });
  const start = from
    ? { x: from.x, y: from.y, scale: Math.max(0.15, from.w / 180), rotateY: 180 }
    : { scale: 0.6, rotateY: 180 };
  return (
    <div className="reveal-stage" aria-live="polite">
      <motion.div
        className="reveal-card"
        initial={reduced ? false : start}
        animate={{ x: 0, y: 0, scale: 1, rotateY: 0 }}
        transition={{ type: 'spring', stiffness: 170, damping: 20 }}
      >
        <CardView card={card} label={caption} size="lg" />
      </motion.div>
      <p className="reveal-caption">{caption}</p>
    </div>
  );
}
