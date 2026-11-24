import type { Card, Suit } from '@tamalou/shared';
import { type CSSProperties, createContext, useContext } from 'react';
import { rankShort } from '../i18n/index.ts';
import { BACK_HEX, BACK_INK, DEFAULT_DECK, type DeckStyle } from './deck.ts';
import type { CardTheme } from './theme.ts';

// The first, plain deck: corner indices and a large centre pip, French court letters (V, D, R), red and black inks
// from the tokens. Colour is never the only cue: every suit has its own symbol. Its back follows the player's style
// (deck.ts): colour, pattern, mark, and an effect (a glint, an iridescent sheen, a holographic foil that also covers
// the court cards and the jokers, like a rare card).

const SYMBOL: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
const isRed = (s: Suit | null) => s === 'H' || s === 'D';

/** The player's style for this deck (cards/deck.ts); the app provides it from the device's settings. */
export const DeckStyleContext = createContext<DeckStyle>(DEFAULT_DECK);

function Face({ card }: { card: Card }) {
  const foil = useContext(DeckStyleContext).effect === 'holo';
  const symbol = card.suit ? SYMBOL[card.suit] : '★';
  const court = card.rank === 'J' || card.rank === 'Q' || card.rank === 'K';
  const shiny = foil && (court || card.rank === 'JOKER');
  return (
    <div className={`classic-face${isRed(card.suit) ? ' red' : ''}${shiny ? ' foil' : ''}`} aria-hidden="true">
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
  const style = useContext(DeckStyleContext);
  const colors = { '--card-back': BACK_HEX[style.color], '--card-back-ink': BACK_INK } as CSSProperties;
  return (
    <div className={`classic-back pat-${style.pattern} fx-${style.effect}`} style={colors} aria-hidden="true">
      {style.mark ? <span>{style.mark}</span> : null}
    </div>
  );
}

export const classicTheme: CardTheme = { id: 'classic', name: 'Classique', Face, Back };
