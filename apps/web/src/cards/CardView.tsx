import type { Card } from '@tamalou/shared';
import { motion } from 'motion/react';
import { useCardTheme } from './context.ts';

// A card in place: it flips (Motion) between its back and, when the viewer may see it, its face. Interactive when given
// `onSelect`: a real button with its label, so a keyboard or a screen reader plays it like a finger.

export interface CardViewProps {
  card: Card | null;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  onSelect?: (() => void) | undefined;
  selected?: boolean;
  /** A move is possible here: drawn with the accent ring. */
  hint?: boolean;
  locked?: boolean;
  empty?: boolean;
}

export function CardView({ card, label, size = 'md', onSelect, selected, hint, locked, empty }: CardViewProps) {
  const theme = useCardTheme();
  if (empty) return <div className={`card card-${size} card-empty`} role="img" aria-label={label} />;
  const className = [
    'card',
    `card-${size}`,
    onSelect ? 'card-active' : '',
    selected ? 'card-selected' : '',
    hint ? 'card-hint' : '',
    locked ? 'card-locked' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const inner = (
    <motion.div
      className="card-inner"
      initial={false}
      animate={{ rotateY: card ? 0 : 180 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
    >
      <div className="card-side card-front">{card ? <theme.Face card={card} /> : null}</div>
      <div className="card-side card-back">
        <theme.Back />
      </div>
    </motion.div>
  );
  if (onSelect) {
    return (
      <button type="button" className={className} aria-label={label} aria-pressed={selected} onClick={onSelect}>
        {inner}
      </button>
    );
  }
  return (
    <div className={className} role="img" aria-label={label}>
      {inner}
    </div>
  );
}
