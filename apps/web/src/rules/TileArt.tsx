import type { Card, Rank, RuleSet, Suit } from '@tamalou/shared';
import type { CSSProperties, ReactNode } from 'react';
import { CardView } from '../cards/CardView.tsx';
import { Icon } from '../game/ActionBar.tsx';
import { cardName, t } from '../i18n/index.ts';

// The small picture on each tile of the game master's screen (the owner's pick H on the 2026-11-24 canvas): cards drawn
// by the card theme (ADR-0007), read from tonight's rules where it shows something (the decks, the jokers, the end).

const card = (rank: Rank, suit: Suit | null): Card => ({ id: -1, rank, suit, deck: 0 });

function Pic({ c, style, children }: { c: Card | null; style?: CSSProperties; children?: ReactNode }) {
  return (
    <span className="rt-pic" style={style}>
      <CardView card={c} label={c ? cardName(c) : t('cardHidden')} size="sm" />
      {children}
    </span>
  );
}

const fan = (i: number, n: number, spread = 10): CSSProperties => ({
  rotate: `${(i - (n - 1) / 2) * spread}deg`,
  marginLeft: i ? 'calc(var(--w) * -0.45)' : 0,
});

export function TileArt({ section, rules: r }: { section: string; rules: RuleSet }) {
  switch (section) {
    case 'deck': {
      const backs = r.deck.count + 1;
      return (
        <span className="rt-fan">
          {Array.from({ length: backs }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed picture
            <Pic key={i} c={null} style={fan(i, backs + (r.deck.jokers ? 1 : 0))} />
          ))}
          {r.deck.jokers ? <Pic c={card('JOKER', null)} style={fan(backs, backs + 1)} /> : null}
        </span>
      );
    }
    case 'values':
      return (
        <span className="rt-fan">
          {[card('A', 'S'), card('10', 'H'), card('K', 'H')].map((c, i) => (
            <Pic key={c.rank} c={c} style={fan(i, 3, 12)} />
          ))}
        </span>
      );
    case 'hand':
      return (
        <span className="rt-hand">
          {[0, 1, 2, 3].map((i) => (
            <Pic key={i} c={null}>
              {i >= 2 ? (
                <span className="rt-eye">
                  <Icon name="look" />
                </span>
              ) : null}
            </Pic>
          ))}
        </span>
      );
    case 'powers':
      return (
        <span className="rt-row">
          <Pic c={card('Q', 'D')} style={{ rotate: '-6deg' }} />
          <span className="rt-marks">
            <Icon name="look" />
            <Icon name="swap" />
          </span>
        </span>
      );
    case 'quick':
      return (
        <span className="rt-row">
          <span className="rt-fan">
            <Pic c={card('6', 'H')} style={{ rotate: '-8deg' }} />
            <Pic
              c={card('6', 'C')}
              style={{ rotate: '10deg', translate: '0 -6px', marginLeft: 'calc(var(--w) * -0.2)' }}
            />
          </span>
          <span className="rt-bolt">
            <Icon name="quick" />
          </span>
        </span>
      );
    case 'tamalou':
      return <span className="rt-call">{t('actCall')}</span>;
    case 'end':
      return r.gameEnd.mode === 'rounds' ? (
        <span className="rt-rounds mono">
          {Array.from({ length: Math.min(r.gameEnd.rounds, 8) }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed picture
            <span key={i} />
          ))}
        </span>
      ) : (
        <span className="rt-meter">
          <span className="mono">
            <span>0</span>
            <b>{r.gameEnd.threshold}</b>
          </span>
          <span className="rt-meter-bar">
            <span />
          </span>
        </span>
      );
    default:
      return (
        <svg className="rt-clock" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5l3 2" />
        </svg>
      );
  }
}
