import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { CardView } from '../cards/CardView.tsx';
import { t } from '../i18n/index.ts';
import { dealLength, dealOrder, dealSeats, ME } from './table.ts';

// Between "Jouer" and the table (the owner's pick, direction C of the 2026-10-22 canvas): the cards leave the middle
// of the felt one at a time, round the table, four times, and land in front of each player, the player's own larger.
// Backs only, from the card theme. The button skips it at any time, then says the hand is ready; with reduced motion
// the cards are simply there.

interface Props {
  me: string;
  others: string[];
  onDone: () => void;
}

export function Deal({ me, others, onDone }: Props) {
  const reduced = useReducedMotion();
  const [done, setDone] = useState(Boolean(reduced));
  const players = others.length + 1;
  useEffect(() => {
    if (reduced) return;
    const id = window.setTimeout(() => setDone(true), dealLength(players));
    return () => window.clearTimeout(id);
  }, [players, reduced]);

  const top = dealSeats(others.length);
  const seats = [ME, ...top];
  return (
    <main className="deal">
      <h1 aria-live="polite">{done ? t('dealDone') : t('dealing')}</h1>
      <div className="deal-felt" aria-hidden="true">
        {[me, ...others].map((name, i) => {
          const s = seats[i] ?? ME;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: a seat is its place round the table
            <span key={i} className={`deal-name${i === 0 ? ' mine' : ''}`} style={{ left: `${s.x}%`, top: `${s.y}%` }}>
              {name}
            </span>
          );
        })}
        {dealOrder(players).map((c) => {
          const s = seats[c.seat] ?? ME;
          const mine = c.seat === 0;
          return (
            <motion.div
              key={`${c.seat}-${c.slot}`}
              className={`deal-card${mine ? ' mine' : ''}`}
              initial={reduced ? false : { left: '50%', top: '42%', x: 0, rotate: ((c.seat * 7 + c.slot * 3) % 9) - 4 }}
              animate={{ left: `${s.x}%`, top: `${s.y}%`, x: (c.slot - 1.5) * (mine ? 1.12 : 0.5) * 56, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 190, damping: 24, delay: c.delay }}
            >
              <CardView card={null} label="" size="sm" />
            </motion.div>
          );
        })}
      </div>
      <button type="button" className="btn btn-primary btn-big" onClick={onDone}>
        {done ? t('dealGo') : t('dealSkip')}
      </button>
    </main>
  );
}
