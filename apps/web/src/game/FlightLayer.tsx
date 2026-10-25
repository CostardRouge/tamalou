import type { Card, GameEvent, PlayerId } from '@tamalou/shared';
import { AnimatePresence, animate, type MotionValue, motion, useMotionValue } from 'motion/react';
import { type CSSProperties, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CardView } from '../cards/CardView.tsx';
import { cardName, t } from '../i18n/index.ts';
import { type Bubble, bubblesOf, type Flight, flightsOf, type Place } from './flights.ts';
import { frontOf } from './front.ts';
import type { HandKind } from './pace.ts';

// Cards fly between the places of the table on a soft spring when a move happens, mine or another player's, and the
// other players say what they do in a bubble by their seat. The table marks its places with `data-place` and its
// seats with `data-seat`; this layer remembers where each place was before the move (the drawn card is already gone
// from the screen when its swap arrives), flies a copy, and hides the destination until the copy lands.
//
// The others' hands (the owner's pick on the 2026-10-24 canvas): when the screen shows them, another player's moves
// are played by their hand, a named cursor with a mouse or a fingertip on a touch screen. It reaches the card, presses,
// carries it to where it goes, and stays a moment; it weighs up a card before a swap and touches a power's targets.
// A player's moves queue in their own lane, so a batch reads one gesture after the other, and a lane that falls behind
// hurries (no weighing up). The hand is rebuilt from the events alone: it works for bots and humans, locally and in a
// room, and shows nothing the events did not already tell.

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A player's lane: when its last gesture is done, and when its last card was picked up. */
interface Lane {
  done: Promise<void>;
  picked: Promise<void>;
}

interface Active {
  id: number;
  flight: Flight;
  from: Box;
  to: Box;
  /** When the move arrived (performance.now()): a hand that falls too far behind lets the card fly on its own. */
  at: number;
  /** Landed: the card is gone and its destination shows, while the hand that carried it lingers. */
  landed?: boolean;
  /** Picked up by its hand: until then the card still lies at its source. */
  lifted?: boolean;
  /** Played by a hand: when it may start, and what it tells its lane. */
  lane?: { start: Promise<void>; picked: () => void; done: () => void };
}

interface Said {
  id: number;
  bubble: Bubble;
  at: Box;
  /** The top it may not rise above: the card in front of the seat. */
  below?: number;
}

const BEAT = 0.34;

// Where a card was let go by hand: its flight starts there rather than from its place, so the move goes on from the
// finger instead of jumping back first.
const dropped = new Map<Place, { box: Box; at: number }>();

export function noteDrop(place: Place, box: Box) {
  dropped.set(place, { box, at: performance.now() });
}

function takeDrop(place: Place): Box | null {
  const d = dropped.get(place);
  dropped.delete(place);
  return d && performance.now() - d.at < 1500 ? d.box : null;
}

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

/** How the others' hands look, or null when the screen does not show them. */
export interface HandsOptions {
  kind: HandKind;
  name: (player: PlayerId) => string;
  /** A CSS colour for the player's hand (their seat's colour). */
  color: (player: PlayerId) => string;
  /** Whose turn it is now: a hand whose player's turn is over goes back to their seat. */
  current: () => PlayerId | null;
}

export interface FlightOptions {
  /** On the first render, the events to play from (the round's deal when the table opens on it). */
  replayFrom?: number;
  /** How many cards each player is dealt. */
  handOf?: (player: PlayerId) => number;
  hands?: HandsOptions | null;
  /** The cards' speed (game/pace.ts, SPEED_FACTOR): springs stiffen with its square, waits shrink with it. */
  speed?: number;
  /** The bots' pace (game/pace.ts, PACE_FACTOR): how long a hand weighs a card up or rests on a target. */
  pace?: number;
}

export interface FlightLayer {
  /** Places a card is flying to: drawn hidden until it lands. */
  landing: ReadonlySet<Place>;
  /** How many cards are on their way to a place (the discard shows the top from before them). */
  inbound: (place: Place) => number;
  /** A hand has yet to pick up the card lying there (another player's drawn card stays in front of them till then). */
  waiting: (place: Place) => boolean;
  layer: ReactNode;
}

/** What every hand shares: where each player's hand last was, and how many gestures each lane still owes. */
interface HandRoom extends HandsOptions {
  speed: number;
  pace: number;
  at: Map<PlayerId, { x: number; y: number; t: number }>;
  busy: Map<PlayerId, number>;
  /** Until when each player looks at the card they just drew, before their hand may take it on. */
  look: Map<PlayerId, number>;
}

/** How long a player looks at the card they drew at least, at normal pace (the owner: «il observe, il décide»). */
const LOOK = 700;

export function useFlights(
  events: readonly GameEvent[],
  me: PlayerId,
  motionOn: boolean,
  { replayFrom, handOf, hands = null, speed = 1, pace = 1 }: FlightOptions = {},
): FlightLayer {
  const seen = useRef(replayFrom ?? events.length);
  const places = useRef(new Map<Place, Box>());
  const nextId = useRef(1);
  const lanes = useRef(new Map<PlayerId, Lane>());
  const handAt = useRef(new Map<PlayerId, { x: number; y: number; t: number }>());
  const busy = useRef(new Map<PlayerId, number>());
  const look = useRef(new Map<PlayerId, number>());
  const [active, setActive] = useState<Active[]>([]);
  const [said, setSaid] = useState<Said[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // After every render, before the screen paints: what the new events move, measured from where things were.
  useLayoutEffect(() => {
    const now = measure();
    if (events.length < seen.current) {
      seen.current = events.length;
      lanes.current.clear();
      busy.current.clear();
    }
    const fresh = events.slice(seen.current);
    seen.current = events.length;
    const before = places.current;
    places.current = now;
    if (fresh.length === 0) return;

    if (motionOn) {
      // A drawn card that came and went within one batch has no place on screen: where it would have been stands in,
      // in front of the player who drew it (game/front.ts), or the middle of the table for mine.
      const middle = boxOf('.center');
      const stand = (by: PlayerId | undefined): Box | null => {
        if (!middle) return null;
        const seat = by && by !== me ? boxOf(`[data-seat="${CSS.escape(by)}"]`) : null;
        if (!seat) return { x: middle.x + middle.w / 2 - 30, y: middle.y + middle.h / 2 - 42, w: 60, h: 84 };
        const at = frontOf(seat, middle, { w: 60, h: 84 }, { w: window.innerWidth, h: window.innerHeight });
        return { ...at, w: 60, h: 84 };
      };
      const find = (place: Place, first: Map<Place, Box>, then: Map<Place, Box>, by?: PlayerId) =>
        first.get(place) ?? then.get(place) ?? (place === 'drawn' ? stand(by) : null);
      const list: Active[] = [];
      for (const flight of flightsOf(fresh, me, handOf)) {
        const by = hands && flight.by && flight.by !== me ? flight.by : null;
        if (flight.tap && !by) continue;
        const from = takeDrop(flight.from) ?? find(flight.from, before, now, flight.by);
        const to = flight.tap ? from : find(flight.to, now, before, flight.by);
        if (!from || !to) continue;
        const item: Active = { id: nextId.current++, flight, from, to, at: performance.now() };
        if (by) item.lane = enqueue(by, flight.alongside === true);
        list.push(item);
      }
      if (list.length > 0) setActive((a) => [...a, ...list]);
    }

    const bubbles = bubblesOf(fresh, me);
    if (bubbles.length > 0) {
      const added: Said[] = [];
      for (const bubble of bubbles) {
        const seat = boxOf(`[data-seat="${CSS.escape(bubble.player)}"]`);
        if (!seat) continue;
        // Under the card they hold up, when it sits under their seat.
        const front = boxOf(`[data-front-of="${CSS.escape(bubble.player)}"]`);
        const below = front && front.y > seat.y + seat.h - 12 ? front.y + front.h + 6 : undefined;
        added.push({ id: nextId.current++, bubble, at: seat, ...(below === undefined ? {} : { below }) });
      }
      const ids = new Set(added.map((s) => s.bubble.player));
      setSaid((s) => [...s.filter((x) => !ids.has(x.bubble.player)), ...added]);
      for (const s of added) {
        timers.current.push(setTimeout(() => setSaid((list) => list.filter((x) => x.id !== s.id)), 1900));
      }
    }
  });

  /** A gesture's place in its player's lane: after the last one, or as soon as its card is picked up (alongside). */
  function enqueue(by: PlayerId, alongside: boolean): NonNullable<Active['lane']> {
    const lane = lanes.current.get(by) ?? { done: Promise.resolve(), picked: Promise.resolve() };
    let picked = () => {};
    let done = () => {};
    const pickedP = new Promise<void>((r) => {
      picked = r;
    });
    const doneP = new Promise<void>((r) => {
      done = r;
    });
    busy.current.set(by, (busy.current.get(by) ?? 0) + 1);
    lanes.current.set(by, {
      done: alongside ? Promise.all([lane.done, doneP]).then(() => {}) : doneP,
      picked: pickedP,
    });
    return {
      start: alongside ? lane.picked : lane.done,
      picked,
      done: () => {
        busy.current.set(by, Math.max(0, (busy.current.get(by) ?? 1) - 1));
        done();
      },
    };
  }

  const remove = (id: number) => setActive((a) => a.filter((x) => x.id !== id));
  const land = (id: number) => setActive((a) => a.map((x) => (x.id === id ? { ...x, landed: true } : x)));
  const lift = (id: number) => setActive((a) => a.map((x) => (x.id === id ? { ...x, lifted: true } : x)));
  // The table shows the state before a move until its gesture has played it: a destination hides from the moment the
  // move arrives (the copy waiting at its source covers what the state already changed there) until the copy lands.
  const flying = active.filter((a) => !a.landed && !a.flight.tap);
  // Moves this render brings that the effect below has not turned into flights yet count as on their way already, so
  // the table never shows their outcome for a frame first (the deal's first discard card flashed then faded).
  const coming =
    motionOn && events.length > seen.current
      ? flightsOf(events.slice(seen.current), me, handOf).filter((f) => !f.tap)
      : [];
  const landing = new Set([...flying.map((a) => a.flight.to), ...coming.map((f) => f.to)]);
  const inbound = (place: Place) =>
    flying.filter((a) => a.flight.to === place).length + coming.filter((f) => f.to === place).length;
  const waiting = (place: Place) =>
    active.some((a) => a.lane && !a.lifted && !a.landed && a.flight.from === place) ||
    (!!hands && coming.some((f) => f.from === place && f.by !== undefined && f.by !== me));
  const room: HandRoom | null = hands
    ? { ...hands, speed, pace, at: handAt.current, busy: busy.current, look: look.current }
    : null;
  const layer = (
    <div className="flights" aria-hidden="true">
      {active.map((a) =>
        a.lane && room ? (
          a.flight.alongside ? (
            <AlongsideCard key={a.id} a={a} speed={speed} onDone={() => remove(a.id)} />
          ) : (
            <CarriedCard
              key={a.id}
              a={a}
              room={room}
              onLift={() => lift(a.id)}
              onLand={() => land(a.id)}
              onDone={() => remove(a.id)}
            />
          )
        ) : (
          <FlyingCard key={a.id} a={a} speed={speed} onDone={() => remove(a.id)} />
        ),
      )}
      <AnimatePresence>
        {stack(said).map(({ s, style }) => (
          <motion.div
            key={s.id}
            className="bubble"
            style={style}
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
  return { landing, inbound, waiting, layer };
}

/**
 * Each bubble centred under its seat and kept on screen (at most 200px wide, so its centre stays 108px from an edge);
 * two bubbles that would overlap (neighbouring seats, or a narrow screen) step down one under the other.
 */
function stack(said: readonly Said[]): { s: Said; style: CSSProperties }[] {
  const placed: { left: number; top: number }[] = [];
  return [...said]
    .sort((a, b) => a.at.x - b.at.x)
    .map((s) => {
      const left = Math.max(108, Math.min(window.innerWidth - 108, s.at.x + s.at.w / 2));
      let top = Math.max(s.at.y + s.at.h - 6, s.below ?? 0);
      while (placed.some((p) => Math.abs(p.left - left) < 200 && Math.abs(p.top - top) < 34)) top += 36;
      placed.push({ left, top });
      return { s, style: { left, top } };
    });
}

function bubbleText(b: Bubble): string {
  return b.card ? t(b.key, { card: cardName(b.card) }) : t(b.key);
}

function FlyingCard({ a, speed, onDone }: { a: Active; speed: number; onDone: () => void }) {
  const { flight, from, to } = a;
  const [face, setFace] = useState<Card | null>(flight.turnsOver ? null : flight.card);
  const delay = (flight.beat * BEAT) / speed;
  useEffect(() => {
    if (!flight.turnsOver) return;
    const id = setTimeout(() => setFace(flight.card), (delay + 0.12 / speed) * 1000);
    return () => clearTimeout(id);
  }, [flight, delay, speed]);
  // A card always lands, even if the spring is cut short (a tab in the background).
  const finish = useRef(onDone);
  finish.current = onDone;
  useEffect(() => {
    const id = setTimeout(() => finish.current(), (delay + 2.2) * 1000);
    return () => clearTimeout(id);
  }, [delay]);
  const lean = Math.max(-14, Math.min(14, (to.x - from.x) * 0.05));
  const k = speed * speed;
  const spring = flight.thrown
    ? { type: 'spring' as const, stiffness: 520 * k, damping: 26 * speed, delay }
    : flight.dealt
      ? { type: 'spring' as const, stiffness: 300 * k, damping: 28 * speed, delay }
      : { type: 'spring' as const, stiffness: 260 * k, damping: 18 * speed, delay };
  return (
    <motion.div
      className="flight"
      style={{ width: to.w, '--w': `${to.w}px` } as CSSProperties}
      // A dealt card waits unseen until it leaves: the deck stays one card, not a pile of shadows.
      initial={{ x: from.x, y: from.y, scale: from.w / to.w, rotate: 0, opacity: flight.dealt ? 0 : 1 }}
      animate={{ x: to.x, y: to.y, scale: 1, rotate: [0, lean, 0], opacity: 1 }}
      transition={{
        x: spring,
        y: spring,
        scale: spring,
        rotate: { duration: 0.7 / speed, delay, ease: 'easeOut' },
        opacity: { duration: 0.01, delay },
      }}
      onAnimationComplete={() => finish.current()}
    >
      <CardView card={face} label="" size="md" />
    </motion.div>
  );
}

/** The other half of an exchange: it flies on its own the moment the hand picks the first card up. */
function AlongsideCard({ a, speed, onDone }: { a: Active; speed: number; onDone: () => void }) {
  const [go, setGo] = useState(false);
  const lane = useRef(a.lane);
  const ended = useRef(false);
  useEffect(() => {
    let alive = true;
    void lane.current?.start.then(() => {
      if (!alive) return;
      lane.current?.picked();
      setGo(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  if (!go) return null;
  return (
    <FlyingCard
      a={{ ...a, flight: { ...a.flight, beat: 0 } }}
      speed={speed}
      onDone={() => {
        if (!ended.current) lane.current?.done();
        ended.current = true;
        onDone();
      }}
    />
  );
}

/**
 * A gesture that would start later than this after its move (ms, at normal speed) is not played by the hand: the card
 * flies straight to its place, so the hands never trail the game by more than a gesture.
 */
const LAG_MAX = 1100;

/** Where a hand presses a card: a little right of and above its middle, as a finger or an arrow's tip would. */
const grip = (b: Box) => ({ x: b.x + b.w * 0.55, y: b.y + b.h * 0.45 });

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * A move played by another player's hand: it reaches, presses, carries the card (or only touches, for a tap). The
 * card's copy sits at its source from the moment the move arrives, so the table reads as before the move until the
 * hand takes it.
 */
function CarriedCard({
  a,
  room,
  onLift,
  onLand,
  onDone,
}: {
  a: Active;
  room: HandRoom;
  onLift: () => void;
  onLand: () => void;
  onDone: () => void;
}) {
  const { flight, from, to } = a;
  const by = flight.by as PlayerId;
  const finger = room.kind === 'finger';
  const cx = useMotionValue(from.x);
  const cy = useMotionValue(from.y);
  const scale = useMotionValue(from.w / to.w);
  const rot = useMotionValue(0);
  const hx = useMotionValue(0);
  const hy = useMotionValue(0);
  const [handOn, setHandOn] = useState(false);
  const [press, setPress] = useState(false);
  const [face, setFace] = useState<Card | null>(flight.turnsOver ? null : flight.card);
  const latest = useRef({ room, onLift, onLand, onDone, lane: a.lane });
  latest.current = { room, onLift, onLand, onDone, lane: a.lane };

  // biome-ignore lint/correctness/useExhaustiveDependencies: one gesture per mount, read from the latest props
  useEffect(() => {
    let alive = true;
    let landed = false;
    const { room: r, lane } = latest.current;
    const s = r.speed;
    // Quick enough to fit between two of a bot's moves, quicker still when the bots are brisk.
    const stiffness = (420 * s * s) / Math.min(1, r.pace);
    // Critically damped and done within a pixel: a spring's long tail kept each gesture waiting for over a second.
    const move = (x: number, y: number, stiffer = 1) => {
      const k = stiffness * stiffer;
      const spring = { type: 'spring' as const, stiffness: k, damping: 2 * Math.sqrt(k), restDelta: 1, restSpeed: 40 };
      return Promise.all([animate(hx, x, spring), animate(hy, y, spring)]).then(() => {});
    };
    const settle = (mv: MotionValue<number>, v: number) =>
      animate(mv, v, {
        type: 'spring',
        stiffness: 400 * s * s,
        damping: 2 * Math.sqrt(400 * s * s),
        restDelta: 0.5,
        restSpeed: 20,
      });
    const finishLanding = (byHand = true) => {
      if (landed) return;
      landed = true;
      // The next gesture in this lane starts from here.
      if (byHand) r.at.set(by, { x: hx.get(), y: hy.get(), t: performance.now() });
      // A card just drawn is looked at before the hand takes it on.
      if (flight.to === 'drawn') r.look.set(by, performance.now() + (LOOK * r.pace) / s);
      latest.current.onLift();
      lane?.picked();
      lane?.done();
      latest.current.onLand();
    };
    // A gesture always ends, even if a spring is cut short (a tab in the background).
    const safety = setTimeout(() => {
      finishLanding();
      latest.current.onDone();
    }, 8000);

    void (async () => {
      await lane?.start;
      if (!alive) return;
      const lag = performance.now() - a.at;
      if (lag > LAG_MAX / s) {
        // Too late for a gesture: the card goes straight to its place, the hand stays where it was.
        if (!flight.tap) {
          const k = 700 * s * s;
          const quick = { type: 'spring' as const, stiffness: k, damping: 2 * 0.9 * Math.sqrt(k) };
          if (flight.turnsOver) setFace(flight.card);
          latest.current.onLift();
          await Promise.all([animate(cx, to.x, quick), animate(cy, to.y, quick), animate(scale, 1, quick)]);
        }
        finishLanding(false);
        clearTimeout(safety);
        latest.current.onDone();
        return;
      }
      const hurry = (r.busy.get(by) ?? 0) > 1;
      // From where this player's hand last was, else from their seat.
      const last = r.at.get(by);
      const seat = boxOf(`[data-seat="${CSS.escape(by)}"]`);
      const start =
        last && performance.now() - last.t < 2000
          ? last
          : seat
            ? { x: seat.x + seat.w / 2, y: seat.y + seat.h - 10 }
            : grip(from);
      // Jumped, not set: a set hands the spring the speed of the leap, which flung the hand off the screen.
      hx.jump(start.x);
      hy.jump(start.y);
      setHandOn(true);
      // It weighs a card up only when it has the time: a lane already behind goes straight for the card.
      if (flight.hover && !hurry && lag < 350 / s) {
        const over = boxOf(`[data-place="${CSS.escape(flight.hover)}"]`);
        if (over) {
          const g = grip(over);
          await move(g.x, g.y);
          await sleep((220 * r.pace) / s);
          if (!alive) return;
        }
      }
      const g = grip(from);
      await move(g.x, g.y, hurry ? 1.6 : 1);
      if (!alive) return;
      // The card they drew: they finish looking at it first.
      const looking = flight.from === 'drawn' ? (r.look.get(by) ?? 0) - performance.now() : 0;
      if (looking > 0) {
        await sleep(looking);
        if (!alive) return;
      }
      setPress(true);
      await sleep(80 / s);
      setPress(false);
      if (flight.tap) {
        // Only a touch: the card is looked at, or chosen, where it lies.
        await sleep((240 * r.pace) / s);
        finishLanding();
      } else {
        latest.current.onLift();
        lane?.picked();
        // The card hangs from the hand: under the arrow's tip, or centred under the finger.
        const off = { x: to.w / 2, y: to.h * (finger ? 0.5 : 0.35) };
        const follow = [hx.on('change', (v) => cx.set(v - off.x)), hy.on('change', (v) => cy.set(v - off.y))];
        void settle(scale, 1);
        void settle(rot, Math.max(-8, Math.min(8, (to.x - from.x) * 0.03)));
        // It turns over as it is lifted, so the face is up by the time it lands.
        if (flight.turnsOver) setFace(flight.card);
        await move(to.x + off.x, to.y + off.y, flight.thrown ? 2 : 1);
        for (const stop of follow) stop();
        if (!alive) return;
        await Promise.all([settle(cx, to.x), settle(cy, to.y), settle(rot, 0)]);
        finishLanding();
      }
      await sleep(220);
      if (!alive) return;
      // The player's turn is over (nothing more in their lane): the hand goes back to their seat before it fades, as a
      // player sits back, rather than resting on the last card it touched.
      if ((r.busy.get(by) ?? 0) === 0 && r.current() !== by) {
        const home = boxOf(`[data-seat="${CSS.escape(by)}"]`);
        if (home) {
          const x = home.x + home.w / 2;
          const y = home.y + home.h - 10;
          await move(x, y);
          r.at.set(by, { x, y, t: performance.now() });
          if (!alive) return;
        }
      }
      setHandOn(false);
      await sleep(200);
      clearTimeout(safety);
      latest.current.onDone();
    })();
    return () => {
      alive = false;
      clearTimeout(safety);
    };
  }, []);

  return (
    <>
      {flight.tap || a.landed ? null : (
        <motion.div
          className="flight"
          style={
            {
              x: cx,
              y: cy,
              scale,
              rotate: rot,
              width: to.w,
              '--w': `${to.w}px`,
              // Another player's drawn card still lies in front of them (FrontCard) until the hand takes it.
              visibility: flight.from === 'drawn' && !a.lifted ? 'hidden' : 'visible',
            } as unknown as CSSProperties
          }
        >
          <CardView card={face} label="" size="md" />
        </motion.div>
      )}
      <motion.div
        className={`reach reach-${room.kind}${handOn ? '' : ' reach-off'}${press ? ' reach-press' : ''}`}
        style={{ x: hx, y: hy, '--who': room.color(by) } as unknown as CSSProperties}
      >
        {finger ? (
          <span className="reach-dot" />
        ) : (
          <svg className="reach-arrow" viewBox="0 0 26 26" aria-hidden="true">
            <path d="M4 3l17 10-7.4 1.9 4.2 7.6-3.4 1.8-4.2-7.7L4 21z" />
          </svg>
        )}
        <span className="reach-tag">{room.name(by)}</span>
      </motion.div>
    </>
  );
}
