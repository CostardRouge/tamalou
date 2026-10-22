import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { trackEvent } from '../audience.ts';
import { CardView } from '../cards/CardView.tsx';
import { cardWords, fill, type LandingText } from './text.ts';
import {
  canCall,
  deckLow,
  freshTut,
  MOVES,
  type Note,
  pointsOf,
  step,
  type TAction,
  type TCard,
  type Tut,
  tappableMine,
  top,
  total,
} from './tutorial.ts';

// The home page's first round (ADR-0017, direction B): the coach on one side, the table on the other, the cards drawn
// by CardView and the card theme (ADR-0007). tutorial.ts holds the rules of this little round; this file draws it and
// plays its timed steps. Cards you can touch are real buttons with their label, like in the game.

const BASE = 70;

/**
 * A hand on a curve halfway between the table's soft arc and its fan (game/hand.ts), the owner's pick on the
 * 2026-10-22 canvas: every card turned about a pivot 5.25 card widths below its foot, neighbours 0.9 widths apart.
 * Malo's hand is seen from across the table: turned round, its pivot by his name, his first card on my right.
 * Returns each card's top-left corner and its turn, in board pixels, the middle of the hand at (cx, cy).
 */
function arcHand(n: number, w: number, cx: number, cy: number, across: boolean) {
  const reach = (5.25 + 0.7) * w;
  const step = Math.asin(0.905 / 5.95);
  return Array.from({ length: n }, (_, i) => {
    const th = (i - (n - 1) / 2) * step;
    const dx = reach * Math.sin(th);
    const dy = reach * (1 - Math.cos(th));
    const x = across ? cx - dx : cx + dx;
    const y = across ? cy - dy : cy + dy;
    return { x: x - w / 2, y: y - w * 0.7, rot: (across ? 180 : 0) + (th * 180) / Math.PI };
  });
}

// The board is 520×480: Malo's hand on top, the deck and the discard side by side in the middle, mine below.
const MINE = arcHand(4, 80, 260, 356, false);
const THEIRS = arcHand(4, 54, 260, 86, true);
const DECK = { x: 188, y: 169, w: 64 };
const DISC = { x: 268, y: 169, w: 64 };

interface Spot {
  x: number;
  y: number;
  w: number;
  z: number;
  up: boolean;
  rot: number;
}

function spots(s: Tut): Map<number, Spot> {
  const m = new Map<number, Spot>();
  s.deck.forEach((c, i) => {
    m.set(c.id, { ...DECK, z: 30 - i, up: false, rot: 0 });
  });
  s.disc.forEach((c, i) => {
    m.set(c.id, { ...DISC, z: 31 + i, up: true, rot: ((i * 37) % 11) - 5 });
  });
  s.you.forEach((c, i) => {
    const { x, y, rot } = MINE[i] ?? { x: 0, y: 0, rot: 0 };
    if (c) m.set(c.id, { x, y, w: 80, z: 20 + i, up: Boolean(s.peek[i]) || s.phase === 'end', rot });
  });
  s.bot.forEach((c, i) => {
    const { x, y, rot } = THEIRS[i] ?? { x: 0, y: 0, rot: 0 };
    m.set(c.id, { x, y, w: 54, z: 20 + i, up: Boolean(s.botPeek[i]) || s.phase === 'end', rot });
  });
  // A card just drawn waits beside the discard, the middle of the table being the piles'.
  if (s.held) m.set(s.held.id, { x: 360, y: 167, w: 64, z: 60, up: true, rot: 6 });
  if (s.botHeld) m.set(s.botHeld.id, { x: 372, y: 44, w: 54, z: 60, up: false, rot: 8 });
  return m;
}

/** Every card of the round, in one fixed order, so each keeps its element (and its motion) wherever it goes. */
const ALL: TCard[] = (() => {
  const s = freshTut();
  return [...s.you, ...s.bot, ...s.deck, ...s.disc].filter((c): c is TCard => c !== null);
})();

function coach(s: Tut, t: LandingText) {
  const tag =
    s.phase === 'end' ? t.tagEnd : s.phase === 'bot' ? t.tagBot : s.called ? t.tagLast : fill(t.tagTurn, { n: s.turn });
  const card = (c: TCard | null) => (c ? cardWords(t, c) : '');
  const say = (title: string, text: string) => ({ tag, title, text });
  switch (s.phase) {
    case 'peek':
      return say(t.peekTitle, t.peekText);
    case 'wait':
      return s.called ? say(t.calledTitle, t.calledText) : say(t.waitTitle, t.waitText);
    case 'turn': {
      if (deckLow(s)) return say(t.lowTitle, t.lowText);
      const d = top(s);
      return say(
        t.turnTitle,
        s.turn === 1
          ? fill(t.turnFirst, { card: card(d), value: d ? pointsOf(d) : 0 })
          : fill(t.turnNext, { card: card(d) }),
      );
    }
    case 'drawn': {
      const h = s.held;
      if (!h) return say('', '');
      if (s.from === 'disc') return say(fill(t.takeTitle, { card: card(h) }), t.takeText);
      const title = fill(t.drawTitle, { card: card(h) });
      if (h.rank === '7' || h.rank === '8') return say(title, t.drawPeekOwn);
      if (h.rank === '9' || h.rank === '10') return say(title, t.drawPeekOther);
      return say(title, pointsOf(h) <= 3 ? t.drawLow : t.drawOther);
    }
    case 'powerOwn':
      return say(t.powerOwnTitle, t.powerOwnText);
    case 'powerOther':
      return say(t.powerOtherTitle, t.powerOtherText);
    case 'quick':
      return say(t.quickTitle, fill(t.quickText, { card: card(top(s)) }));
    case 'bot':
      return say(t.botTitle, t.botText);
    case 'end': {
      const me = total(s.you);
      const bot = total(s.bot);
      return me < bot ? say(fill(t.winTitle, { me, bot }), t.winText) : say(fill(t.loseTitle, { me, bot }), t.loseText);
    }
  }
}

function noteText(n: Note | null, t: LandingText): string {
  if (!n) return '';
  switch (n.k) {
    case 'swapOut':
      return fill(t.noteSwapOut, { card: cardWords(t, n.card) });
    case 'quickHit':
      return t.noteQuickHit;
    case 'quickMiss':
      return t.noteQuickMiss;
    case 'botSwap':
      return fill(t.noteBotSwap, { card: cardWords(t, n.card) });
    case 'botDiscard':
      return fill(t.noteBotDiscard, { card: cardWords(t, n.card) });
  }
}

export function Tutorial({ text: t, play }: { text: LandingText; play: string }) {
  const [s, setS] = useState(freshTut);
  const current = useRef(s);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const run = useCallback((a: TAction) => {
    const r = step(current.current, a);
    if (r.state.phase === 'end' && current.current.phase !== 'end') {
      trackEvent('tutorial-finished', { won: total(r.state.you) < total(r.state.bot), moves: r.state.learned.length });
    }
    current.current = r.state;
    setS(r.state);
    clearTimeout(timer.current);
    const next = r.after;
    if (next) timer.current = setTimeout(() => run(next.action), next.ms);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const c = coach(s, t);
  const at = spots(s);
  const mine = new Set(tappableMine(s));
  const won = total(s.you) < total(s.bot);
  const actions: Array<{ label: string; kind: string; action: TAction }> = [];
  if (s.phase === 'turn') {
    if (!deckLow(s)) {
      actions.push({ label: t.actDraw, kind: 'btn-a', action: { t: 'draw', from: 'deck' } });
      actions.push({ label: t.actTake, kind: 'btn-ghost', action: { t: 'draw', from: 'disc' } });
    }
    if (canCall(s)) actions.push({ label: t.actCall, kind: 'btn-b', action: { t: 'tamalou' } });
  }
  if (s.phase === 'drawn' && s.from === 'deck')
    actions.push({ label: t.actDiscard, kind: 'btn-ghost', action: { t: 'discard' } });
  if (s.phase === 'quick') actions.push({ label: t.actPass, kind: 'btn-ghost', action: { t: 'letPass' } });
  if (s.phase === 'end') actions.push({ label: t.actReplay, kind: 'btn-ghost', action: { t: 'restart' } });

  return (
    <>
      <div className="coach">
        <span className="coach-tag">{c.tag}</span>
        <h2>{c.title}</h2>
        <p aria-live="polite">{c.text}</p>
        <p className="coach-note" aria-live="polite">
          {noteText(s.note, t)}
        </p>
        <div className="coach-acts">
          {actions.map((a) => (
            <button key={a.label} type="button" className={`btn btn-sm ${a.kind}`} onClick={() => run(a.action)}>
              {a.label}
            </button>
          ))}
        </div>
        {s.phase === 'end' ? (
          <div className="coach-after">
            <b>{won ? t.winLine : t.loseLine}</b>
            <a className="btn btn-a" href={play}>
              {t.play}
            </a>
          </div>
        ) : null}
        <div className="coach-moves">
          <h3>
            {t.movesTitle} <b>{s.learned.length}/7</b>
          </h3>
          <ul>
            {MOVES.map((m, i) => (
              <li key={m} className={s.learned.includes(m) ? 'ok' : ''}>
                {t.moves[i]}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="board-box">
        <div className="board">
          <span className={`who${s.phase === 'bot' ? ' on' : ''}`} style={{ left: 260, top: 12 }}>
            {t.bot}
          </span>
          <span className={`who${s.phase === 'bot' || s.phase === 'end' ? '' : ' on'}`} style={{ left: 260, top: 446 }}>
            {t.you}
          </span>
          <span className="pile" style={{ left: DECK.x, top: 262 }}>
            {t.piles[0]}
          </span>
          <span className="pile" style={{ left: DISC.x, top: 262 }}>
            {t.piles[1]}
          </span>
          {ALL.map((card) => {
            const p = at.get(card.id) ?? { ...DECK, z: 0, up: false, rot: 0 };
            const slot = s.you.findIndex((y) => y?.id === card.id);
            const theirs = s.bot.findIndex((b) => b.id === card.id);
            const onSelect =
              slot >= 0 && mine.has(slot)
                ? () => run({ t: 'tapMine', i: slot })
                : theirs >= 0 && s.phase === 'powerOther'
                  ? () => run({ t: 'tapBot', i: theirs })
                  : undefined;
            const label =
              slot >= 0
                ? fill(t.yourSlot, { where: t.where[slot] ?? '' })
                : theirs >= 0
                  ? fill(t.botSlot, { where: t.where[THEIRS.length - 1 - theirs] ?? '' })
                  : '';
            return (
              <motion.div
                key={card.id}
                className="board-card"
                style={{ zIndex: p.z }}
                initial={false}
                animate={{
                  x: p.x - (BASE - p.w) / 2,
                  y: p.y - ((BASE - p.w) * 1.4) / 2,
                  scale: p.w / BASE,
                  rotate: p.rot,
                }}
                transition={{ type: 'spring', stiffness: 190, damping: 25 }}
              >
                <CardView
                  card={p.up ? { ...card, deck: 0 } : null}
                  label={label}
                  onSelect={onSelect}
                  hint={Boolean(onSelect)}
                />
              </motion.div>
            );
          })}
          <AnimatePresence>
            {s.phase === 'end' ? (
              <motion.div key="scores" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <span className={`chip${won ? '' : ' win'}`} style={{ left: 380, top: 74 }}>
                  {fill(t.points, { who: t.bot, n: total(s.bot) })}
                </span>
                <span className={`chip${won ? ' win' : ''}`} style={{ left: 20, top: 280 }}>
                  {fill(t.points, { who: t.you, n: total(s.you) })}
                </span>
              </motion.div>
            ) : null}
            {s.splash ? (
              <motion.div key="splash" className="splash" exit={{ opacity: 0 }}>
                <motion.span
                  initial={{ scale: 2.2, opacity: 0, rotate: -6 }}
                  animate={{ scale: 1, opacity: 1, rotate: -6 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 16 }}
                >
                  {t.splash}
                </motion.span>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
