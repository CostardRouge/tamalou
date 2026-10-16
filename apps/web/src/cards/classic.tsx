import type { Card, Suit } from '@tamalou/shared';
import { rankShort } from '../i18n/index.ts';
import type { CardTheme } from './theme.ts';

// The first, plain deck: corner indices and a large centre pip, French court letters (V, D, R), red and black inks
// from the tokens. Colour is never the only cue: every suit has its own symbol.

const SYMBOL: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
const isRed = (s: Suit | null) => s === 'H' || s === 'D';

function Face({ card }: { card: Card }) {
  const symbol = card.suit ? SYMBOL[card.suit] : '★';
  const court = card.rank === 'J' || card.rank === 'Q' || card.rank === 'K';
  return (
    <div className={`classic-face${isRed(card.suit) ? ' red' : ''}`} aria-hidden="true">
      <span className="corner tl">
        <b>{rankShort(card)}</b>
        <i>{symbol}</i>
      </span>
      <span className={`pip${court ? ' court' : ''}${card.rank === 'JOKER' ? ' joker' : ''}`}>
        {court ? rankShort(card) : symbol}
      </span>
      <span className="corner br">
        <b>{rankShort(card)}</b>
        <i>{symbol}</i>
      </span>
    </div>
  );
}

function Back() {
  return (
    <div className="classic-back" aria-hidden="true">
      <span>T</span>
    </div>
  );
}

export const classicTheme: CardTheme = { id: 'classic', name: 'Classique', Face, Back };
