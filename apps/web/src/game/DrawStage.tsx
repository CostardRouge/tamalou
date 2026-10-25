import { type ReactNode, useLayoutEffect, useRef } from 'react';
import { type Rect, stageOf } from './front.ts';

// My drawn card shown large (the "big" draw view, game/front.ts): in the open part of the table, the rest dimmed,
// while my hand, the discard and the buttons stay bright above the dimming, so the card can still be dragged onto one
// of my cards or onto the discard, or played with a tap. Nothing else can happen meanwhile: my draw closed the quick
// discard. Placed by hand before the flights measure the table, like FrontCard.

const CAPTION = 40;

export function DrawStage({ caption, children }: { caption: string; children: ReactNode }) {
  const el = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const place = () => {
      const node = el.current;
      const bar = document.querySelector('.game-bar');
      const mine = document.querySelector('.mine');
      const piles = [...document.querySelectorAll('.center .pile')].map(rect);
      if (!node || !bar || !mine || piles.length === 0) return;
      const at = stageOf(
        {
          bar: rect(bar),
          piles: union(piles),
          mine: rect(mine),
          screen: { w: window.innerWidth, h: window.innerHeight },
        },
        CAPTION,
      );
      node.style.left = `${at.x}px`;
      node.style.top = `${at.y}px`;
      node.style.setProperty('--stage-w', `${at.w}px`);
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  });
  return (
    <>
      <div className="draw-scrim" aria-hidden="true" />
      <div ref={el} className="draw-stage drawn">
        {children}
        <p className="draw-caption">{caption}</p>
      </div>
    </>
  );
}

function rect(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

function union(rs: Rect[]): Rect {
  const x = Math.min(...rs.map((r) => r.x));
  const y = Math.min(...rs.map((r) => r.y));
  const right = Math.max(...rs.map((r) => r.x + r.w));
  const bottom = Math.max(...rs.map((r) => r.y + r.h));
  return { x, y, w: right - x, h: bottom - y };
}
