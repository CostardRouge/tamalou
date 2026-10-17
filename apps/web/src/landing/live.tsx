import type { Card, Rank, Suit } from '@tamalou/shared';
import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CardView } from '../cards/CardView.tsx';
import type { LandingText } from './text.ts';

// The home page's live table (ADR-0016): one round of Tamalou played by itself on a phone-sized table, scene after
// scene, with a caption for each. Scripted rather than run by the engine, so it always tells the same short story
// (peek, draw, swap, quick discard, a power, the call, the count); the cards are the game's own (CardView and the card
// theme). A visitor can pause it or jump to a step; it also waits while it is off screen or the tab is hidden.

/** "K-H" → a card; the id only has to be unique on the page. */
export function cardOf(spec: string, id: number): Card {
  const [rank, suit] = spec.split('-') as [Rank, Suit];
  return { id, rank, suit, deck: 0 };
}

const BASE_W = 66;
const BASE_H = BASE_W * 1.4;
const DECK = { x: 88, y: 212, w: 62 };
const DISC = { x: 190, y: 212, w: 62 };
const HOLD = { x: 256, y: 300, w: 62 };

interface Def {
  id: string;
  card: string;
  x: number;
  y: number;
  w: number;
}

const mine = (id: string, card: string, x: number, y: number): Def => ({ id, card, x, y, w: BASE_W });
const theirs = (id: string, card: string, x: number, y: number): Def => ({ id, card, x, y, w: 34 });

/** Dealing order: Léa, Malo, you, four times; the deck's next draws and the first discard first. */
const DEFS: Def[] = [
  { id: 'X1', card: '3-S', ...DECK },
  { id: 'X2', card: '7-C', ...DECK },
  { id: 'S0', card: '5-H', ...DISC },
  theirs('L0', 'Q-C', 38, 62),
  theirs('M0', '8-H', 228, 62),
  mine('P0', '9-D', 99, 392),
  theirs('L1', '4-D', 78, 62),
  theirs('M1', 'J-S', 268, 62),
  mine('P1', 'A-S', 175, 392),
  theirs('L2', '9-S', 38, 116),
  theirs('M2', '5-C', 228, 116),
  mine('P2', '2-H', 99, 494),
  theirs('L3', '6-S', 78, 116),
  theirs('M3', 'K-S', 268, 116),
  mine('P3', 'K-D', 175, 494),
];

/** How long each scene stays, in ms; the captions follow the same order (text.liveCaptions). */
export const DURATIONS = [900, 1800, 2600, 800, 1900, 2200, 2600, 1500, 2300, 900, 2100, 4600];
/** The step each scene belongs to (0: before the first one), and the scene each step starts at. */
const STEP_OF = [0, 0, 1, 1, 2, 3, 4, 5, 5, 5, 6, 7];
const STEP_STARTS = [2, 4, 5, 6, 7, 10, 11];

interface Spot {
  x: number;
  y: number;
  w: number;
  up: boolean;
  z: number;
  rot: number;
  glow: boolean;
  delay: number;
}

/** Where a card is, and whether it shows its face, in scene k. */
export function place(d: Def, k: number, order: number): Spot {
  const p: Spot = { x: d.x, y: d.y, w: d.w, up: false, z: 6, rot: 0, glow: false, delay: 0 };
  const at = (q: { x: number; y: number; w: number }) => Object.assign(p, { x: q.x, y: q.y, w: q.w });
  const hand = /^[LMP]/.test(d.id);
  if (k === 0) {
    at(DECK);
    p.z = d.id.startsWith('X') ? 1 : 3;
    return p;
  }
  if (k === 1 && hand) p.delay = (order - 3) * 70;
  if (hand && k === 11) p.up = true;
  if (d.id === 'S0') Object.assign(p, { up: true, z: 2 });
  if ((d.id === 'P2' || d.id === 'P3') && k === 2) p.up = true;
  if (d.id === 'X1') {
    if (k < 4) Object.assign(at(DECK), { z: 1 });
    else if (k === 4) Object.assign(at(HOLD), { up: true, z: 30, rot: 6 });
    else Object.assign(at({ x: 99, y: 392, w: BASE_W }), { z: 7, up: k === 11 });
  }
  if (d.id === 'P0' && k >= 5) Object.assign(at(DISC), { up: true, z: 3, rot: -4 });
  if (d.id === 'L2' && k >= 6) Object.assign(at(DISC), { up: true, z: 4, rot: -12 });
  if (d.id === 'X2') {
    if (k < 7) Object.assign(at(DECK), { z: 1 });
    else if (k === 7) Object.assign(at(HOLD), { up: true, z: 30, rot: 6 });
    else Object.assign(at(DISC), { up: true, z: 5, rot: 9 });
  }
  if (d.id === 'P1' && k === 8) Object.assign(p, { up: true, glow: true });
  return p;
}

const pop = {
  initial: { scale: 0.4, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { opacity: 0 },
  transition: { type: 'spring', stiffness: 400, damping: 18 },
} as const;

function At({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return <div style={{ position: 'absolute', left: x, top: y }}>{children}</div>;
}

export function LiveTable({ text, steps }: { text: LandingText; steps: Element | null }) {
  const [k, setK] = useState(0);
  const [paused, setPaused] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const box = useRef<HTMLDivElement>(null);

  // Waits while the table is off screen or the tab hidden: nothing moves that nobody watches.
  useEffect(() => {
    const el = box.current;
    let seen = true;
    const update = () => setOnScreen(seen && document.visibilityState !== 'hidden');
    const io =
      el && 'IntersectionObserver' in globalThis
        ? new IntersectionObserver(([e]) => {
            seen = e?.isIntersecting ?? true;
            update();
          })
        : null;
    if (el) io?.observe(el);
    document.addEventListener('visibilitychange', update);
    return () => {
      io?.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  useEffect(() => {
    if (paused || !onScreen) return;
    const id = setTimeout(() => setK((n) => (n + 1) % DURATIONS.length), DURATIONS[k]);
    return () => clearTimeout(id);
  }, [k, paused, onScreen]);

  const [lea, malo, me] = text.liveNames;
  const pts = (n: number) => text.livePoints.replace('{n}', String(n));
  const step = STEP_OF[k] ?? 0;
  const mineToPlay = k === 4 || k === 5 || (k >= 7 && k <= 10);

  return (
    <>
      <div className="lt-phone" ref={box}>
        <div className="lt-screen" role="img" aria-label={text.liveAria}>
          <span className={`lt-who${k === 6 ? ' on' : ''}`} style={{ left: 34, top: 34 }}>
            {lea}
          </span>
          <span className="lt-who" style={{ left: 224, top: 34 }}>
            {malo}
          </span>
          <span className={`lt-who${mineToPlay ? ' on' : ''}`} style={{ left: 95, top: 364 }}>
            {me}
          </span>
          {[4, 2].map((o) => (
            <div
              key={o}
              className="lt-card"
              style={{
                transform: `translate(${DECK.x + o - (BASE_W - DECK.w) / 2}px, ${DECK.y + o - (BASE_H - DECK.w * 1.4) / 2}px) scale(${DECK.w / BASE_W})`,
              }}
            >
              <CardView card={null} label="" size="md" />
            </div>
          ))}
          <span className="lt-pile" style={{ left: DECK.x, top: 302 }}>
            {text.livePiles[0]}
          </span>
          <span className="lt-pile" style={{ left: DISC.x, top: 302 }}>
            {text.livePiles[1]}
          </span>
          {DEFS.map((d, i) => {
            const p = place(d, k, i);
            const scale = p.w / BASE_W;
            return (
              <motion.div
                key={d.id}
                className={`lt-card${p.glow ? ' lt-glow' : ''}`}
                style={{ zIndex: p.z }}
                initial={false}
                animate={{
                  x: p.x - (BASE_W - p.w) / 2,
                  y: p.y - (BASE_H - p.w * 1.4) / 2,
                  scale,
                  rotate: p.rot,
                }}
                transition={{ type: 'spring', stiffness: 170, damping: 24, delay: p.delay / 1000 }}
              >
                <CardView card={p.up ? cardOf(d.card, i) : null} label="" size="md" />
              </motion.div>
            );
          })}
          <AnimatePresence>
            {k === 6 ? (
              <motion.span key="quick" className="lt-bubble" style={{ left: 70, top: 172 }} {...pop}>
                {text.liveQuick}
              </motion.span>
            ) : null}
            {k === 8 ? (
              <motion.span key="power" className="lt-bubble power" style={{ left: 24, top: 316 }} {...pop}>
                {text.livePower}
              </motion.span>
            ) : null}
            {k === 11 ? (
              <motion.div key="scores" {...pop}>
                <At x={40} y={172}>
                  <span className="lt-chip" style={{ position: 'static' }}>
                    {pts(20)}
                  </span>
                </At>
                <At x={230} y={172}>
                  <span className="lt-chip" style={{ position: 'static' }}>
                    {pts(33)}
                  </span>
                </At>
                <At x={14} y={450}>
                  <span className="lt-chip win" style={{ position: 'static' }}>
                    {pts(6)}
                  </span>
                </At>
              </motion.div>
            ) : null}
            {k === 10 ? (
              <motion.div key="splash" className="lt-splash" exit={{ opacity: 0 }}>
                <motion.span
                  initial={{ scale: 2.2, opacity: 0, rotate: -6 }}
                  animate={{ scale: 1, opacity: 1, rotate: -6 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 16 }}
                >
                  {text.liveSplash}
                </motion.span>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
      <p className="lt-caption">{text.liveCaptions[k]}</p>
      <div className="lt-controls">
        <button type="button" className="btn btn-ghost btn-sm" aria-pressed={paused} onClick={() => setPaused(!paused)}>
          {paused ? text.liveResume : text.livePause}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setPaused(false);
            setK(0);
          }}
        >
          {text.liveRestart}
        </button>
      </div>
      {steps
        ? createPortal(
            <ol className="lt-steps" aria-label={text.liveStepsAria}>
              {text.liveSteps.map((label, i) => (
                <li key={label}>
                  <button
                    type="button"
                    className="lt-step"
                    aria-current={step === i + 1 ? 'step' : undefined}
                    onClick={() => setK(STEP_STARTS[i] ?? 0)}
                  >
                    <b>0{i + 1}</b>
                    {label}
                  </button>
                </li>
              ))}
            </ol>,
            steps,
          )
        : null}
    </>
  );
}
