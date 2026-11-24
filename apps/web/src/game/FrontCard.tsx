import type { Card } from '@tamalou/shared';
import { type CSSProperties, useLayoutEffect, useRef } from 'react';
import { CardView } from '../cards/CardView.tsx';
import { facing, frontOf, liftOf } from './front.ts';

// Another player's drawn card, in front of their seat (game/front.ts): face down for me, raised on their side as they
// look at it (the edge towards the middle stays down), its back turned their way, with an eye; a card taken from the
// discard stays face up and leans the other way, its face turned to them and a little in shadow. It carries the
// table's `drawn` place, so the draw lands here and the swap or
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
      // Raised so that its face turns towards them: about the edge facing the middle when it is hidden, about their own
      // edge when everyone has seen it (front.ts, liftOf).
      const lift = liftOf(rect(seat), rect(middle), card !== null);
      node.style.setProperty('--lift-x', lift.axis.x.toFixed(3));
      node.style.setProperty('--lift-y', lift.axis.y.toFixed(3));
      node.style.setProperty('--lift-origin', lift.origin);
      node.style.setProperty('--lift-angle', `${lift.angle}deg`);
      node.style.setProperty('--back-turn', `${facing(rect(seat), rect(middle))}deg`);
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  });
  return (
    <div
      ref={el}
      className={card ? 'front-card front-open' : 'front-card'}
      data-front-of={holder}
      style={{ '--who': color } as CSSProperties}
    >
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
