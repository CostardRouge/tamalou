import type { Card, GameEvent, PlayerId } from '@tamalou/shared';
import { AnimatePresence, motion } from 'motion/react';
import { type CSSProperties, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CardView } from '../cards/CardView.tsx';
import { cardName, t } from '../i18n/index.ts';
import { type Bubble, bubblesOf, type Flight, flightsOf, type Place } from './flights.ts';

// Cards fly between the places of the table on a soft spring when a move happens, mine or another player's, and the
// other players say what they do in a bubble by their seat. The table marks its places with `data-place` and its
// seats with `data-seat`; this layer remembers where each place was before the move (the drawn card is already gone
// from the screen when its swap arrives), flies a copy, and hides the destination until the copy lands.

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Active {
  id: number;
  flight: Flight;
  from: Box;
  to: Box;
}

interface Said {
  id: number;
  bubble: Bubble;
  at: Box;
}

const BEAT = 0.34;

function measure(): Map<Place, Box> {
  const out = new Map<Place, Box>();
  for (const el of document.querySelectorAll<HTMLElement>('[data-place]')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0) out.set(el.dataset.place as Place, { x: r.left, y: r.top, w: r.width, h: r.height });
  }
  return out;
}

function boxOf(selector: string): Box | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

export interface FlightLayer {
  /** Places a card is flying to: drawn hidden until it lands. */
  landing: ReadonlySet<Place>;
  layer: ReactNode;
}

export function useFlights(events: readonly GameEvent[], me: PlayerId, motionOn: boolean): FlightLayer {
  const seen = useRef(events.length);
  const places = useRef(new Map<Place, Box>());
  const nextId = useRef(1);
  const [active, setActive] = useState<Active[]>([]);
  const [said, setSaid] = useState<Said[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // After every render, before the screen paints: what the new events move, measured from where things were.
  useLayoutEffect(() => {
    const now = measure();
    if (events.length < seen.current) seen.current = events.length;
    const fresh = events.slice(seen.current);
    seen.current = events.length;
    const before = places.current;
    places.current = now;
    if (fresh.length === 0) return;

    if (motionOn) {
      // A drawn card that came and went within one batch has no place on screen: the middle of the table stands in.
      const middle = boxOf('.center');
      const stand = middle ? { x: middle.x + middle.w / 2 - 30, y: middle.y + middle.h / 2 - 42, w: 60, h: 84 } : null;
      const find = (place: Place, first: Map<Place, Box>, then: Map<Place, Box>) =>
        first.get(place) ?? then.get(place) ?? (place === 'drawn' ? stand : null);
      const list: Active[] = [];
      for (const flight of flightsOf(fresh, me)) {
        const from = find(flight.from, before, now);
        const to = find(flight.to, now, before);
        if (from && to) list.push({ id: nextId.current++, flight, from, to });
      }
      if (list.length > 0) setActive((a) => [...a, ...list]);
    }

    const bubbles = bubblesOf(fresh, me);
    if (bubbles.length > 0) {
      const added: Said[] = [];
      for (const bubble of bubbles) {
        const seat = boxOf(`[data-seat="${CSS.escape(bubble.player)}"]`);
        if (seat) added.push({ id: nextId.current++, bubble, at: seat });
      }
      const ids = new Set(added.map((s) => s.bubble.player));
      setSaid((s) => [...s.filter((x) => !ids.has(x.bubble.player)), ...added]);
      for (const s of added) {
        timers.current.push(setTimeout(() => setSaid((list) => list.filter((x) => x.id !== s.id)), 1900));
      }
    }
  });

  const done = (id: number) => setActive((a) => a.filter((x) => x.id !== id));
  const landing = new Set(active.map((a) => a.flight.to));
  const layer = (
    <div className="flights" aria-hidden="true">
      {active.map((a) => (
        <FlyingCard key={a.id} a={a} onDone={() => done(a.id)} />
      ))}
      <AnimatePresence>
        {said.map((s) => (
          <motion.div
            key={s.id}
            className="bubble"
            style={bubbleBox(s.at)}
            initial={{ opacity: 0, y: -8, scale: 0.7 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          >
            {bubbleText(s.bubble)}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
  return { landing, layer };
}

function bubbleBox(seat: Box): CSSProperties {
  // Centred under the seat, kept on screen: a bubble is at most 200px wide, so its centre stays 108px from an edge.
  const centre = Math.max(108, Math.min(window.innerWidth - 108, seat.x + seat.w / 2));
  return { left: centre, top: seat.y + seat.h - 6 };
}

function bubbleText(b: Bubble): string {
  return b.card ? t(b.key, { card: cardName(b.card) }) : t(b.key);
}

function FlyingCard({ a, onDone }: { a: Active; onDone: () => void }) {
  const { flight, from, to } = a;
  const [face, setFace] = useState<Card | null>(flight.turnsOver ? null : flight.card);
  const delay = flight.beat * BEAT;
  useEffect(() => {
    if (!flight.turnsOver) return;
    const id = setTimeout(() => setFace(flight.card), (delay + 0.12) * 1000);
    return () => clearTimeout(id);
  }, [flight, delay]);
  // A card always lands, even if the spring is cut short (a tab in the background).
  const finish = useRef(onDone);
  finish.current = onDone;
  useEffect(() => {
    const id = setTimeout(() => finish.current(), (delay + 2.2) * 1000);
    return () => clearTimeout(id);
  }, [delay]);
  const lean = Math.max(-14, Math.min(14, (to.x - from.x) * 0.05));
  const spring = flight.thrown
    ? { type: 'spring' as const, stiffness: 520, damping: 26, delay }
    : { type: 'spring' as const, stiffness: 260, damping: 18, delay };
  return (
    <motion.div
      className="flight"
      style={{ width: to.w, '--w': `${to.w}px` } as CSSProperties}
      initial={{ x: from.x, y: from.y, scale: from.w / to.w, rotate: 0 }}
      animate={{ x: to.x, y: to.y, scale: 1, rotate: [0, lean, 0] }}
      transition={{ x: spring, y: spring, scale: spring, rotate: { duration: 0.7, delay, ease: 'easeOut' } }}
      onAnimationComplete={() => finish.current()}
    >
      <CardView card={face} label="" size="md" />
    </motion.div>
  );
}
