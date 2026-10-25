import type { Card } from '@tamalou/shared';
import { type CSSProperties, useLayoutEffect, useRef } from 'react';
import { CardView } from '../cards/CardView.tsx';
import { facing, frontOf, towards } from './front.ts';

// Another player's drawn card, in front of their seat (game/front.ts): face down for me, raised on their side as they
// look at it (the edge towards the middle stays down), its back turned their way, with an eye. It carries the table's `drawn` place, so the draw lands here and the swap or
// the discard leaves from here. Placed by hand before the flights measure the table: its seat may sit anywhere (a row
// on a phone, the oval on a wide table), and a seat in a scrolling row would clip a card drawn inside it.

interface Props {
  holder: string;
  name: string;
  /** Their name by the eye, when no hand of theirs already says whose card it is. */
  named: boolean;
  color: string;
  card: Card | null;
  label: string;
  ghost: boolean;
}

export function FrontCard({ holder, name, named, color, card, label, ghost }: Props) {
  const el = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const place = () => {
      const node = el.current;
      const seat = document.querySelector(`[data-seat="${CSS.escape(holder)}"]`);
      const middle = document.querySelector('.center');
      if (!node || !seat || !middle) return;
      const at = frontOf(
        rect(seat),
        rect(middle),
        { w: node.offsetWidth, h: node.offsetHeight },
        {
          w: window.innerWidth,
          h: window.innerHeight,
        },
      );
      node.style.left = `${at.x}px`;
      node.style.top = `${at.y}px`;
      // Raised about the edge that faces the middle: their side comes up towards me, its face towards them.
      const d = towards(rect(seat), rect(middle));
      node.style.setProperty('--lift-x', `${(-d.dy).toFixed(3)}`);
      node.style.setProperty('--lift-y', `${d.dx.toFixed(3)}`);
      node.style.setProperty('--lift-origin', `${50 + d.dx * 50}% ${50 + d.dy * 50}%`);
      node.style.setProperty('--back-turn', `${facing(rect(seat), rect(middle))}deg`);
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  });
  return (
    <div ref={el} className="front-card" data-front-of={holder} style={{ '--who': color } as CSSProperties}>
      <div className="front-tilt">
        <CardView card={card} place="drawn" ghost={ghost} label={label} size="md" />
      </div>
      <span className="front-eye" aria-hidden="true">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        {named ? name : null}
      </span>
    </div>
  );
}

function rect(el: Element) {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}
