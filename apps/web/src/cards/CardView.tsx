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
  /** A move just touched this card: a short ring so the eye follows it. */
  flash?: boolean;
  /** Its place on the table (`deck`, `slot:<player>:<slot>`…), where flying cards leave from and land. */
  place?: string;
  /** A flying copy is on its way here: this one waits, invisible, until it lands. */
  ghost?: boolean;
}

export function CardView({
  card,
  label,
  size = 'md',
  onSelect,
  selected,
  hint,
  locked,
  empty,
  flash,
  place,
  ghost,
}: CardViewProps) {
  const theme = useCardTheme();
  if (empty) {
    return <div className={`card card-${size} card-empty`} role="img" aria-label={label} data-place={place} />;
  }
  const className = [
    'card',
    `card-${size}`,
    onSelect ? 'card-active' : '',
    selected ? 'card-selected' : '',
    hint ? 'card-hint' : '',
    locked ? 'card-locked' : '',
    flash ? 'card-flash' : '',
    ghost ? 'card-ghost' : '',
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
      <button
        type="button"
        className={className}
        aria-label={label}
        aria-pressed={selected}
        onClick={onSelect}
        data-place={place}
      >
        {inner}
      </button>
    );
  }
  return (
    <div className={className} role="img" aria-label={label} data-place={place}>
      {inner}
    </div>
  );
}
