import type { Card } from '@tamalou/shared';
import type { CSSProperties } from 'react';
import { updateSettings, useSettings } from '../feedback/settings.ts';
import { type Key, t } from '../i18n/index.ts';
import { CardView } from './CardView.tsx';
import { DeckStyleContext } from './classic.tsx';
import {
  BACK_COLORS,
  BACK_HEX,
  type BackColor,
  cleanMark,
  DEFAULT_DECK,
  type DeckStyle,
  EFFECTS,
  type Effect,
  MAX_MARK,
  PATTERNS,
  type Pattern,
} from './deck.ts';

// «Tes cartes» (the owner, 2026-11-24): the back's colour, its pattern, the mark in its middle, an effect; the cards
// above change as the player picks. A setting of this device, kept with the others (feedback/settings.ts).

const COLOR_NAME: Record<BackColor, Key> = {
  cobalt: 'deckCobalt',
  vermilion: 'deckVermilion',
  emerald: 'deckEmerald',
  violet: 'deckViolet',
  night: 'deckNight',
  bordeaux: 'deckBordeaux',
};
const PATTERN_NAME: Record<Pattern, Key> = {
  stripes: 'patternStripes',
  diamonds: 'patternDiamonds',
  dots: 'patternDots',
  checks: 'patternChecks',
  plain: 'patternPlain',
};
const EFFECT_NAME: Record<Effect, Key> = {
  none: 'effectNone',
  shine: 'effectShine',
  iris: 'effectIris',
  holo: 'effectHolo',
};
const EFFECT_HINT: Record<Effect, Key> = {
  none: 'effectNoneHint',
  shine: 'effectShineHint',
  iris: 'effectIrisHint',
  holo: 'effectHoloHint',
};

const KING: Card = { id: -10, rank: 'K', suit: 'H', deck: 0 };
const SEVEN: Card = { id: -11, rank: '7', suit: 'S', deck: 0 };

export function DeckPicker({ name }: { name: string }) {
  const deck = useSettings().deck;
  const set = (patch: Partial<DeckStyle>) => updateSettings({ deck: { ...deck, ...patch } });
  const changed = JSON.stringify(deck) !== JSON.stringify(DEFAULT_DECK);
  return (
    <fieldset className="field deck-picker">
      <legend>{t('deckTitle')}</legend>
      <DeckStyleContext.Provider value={deck}>
        <div className="deck-preview" aria-hidden="true">
          <CardView card={null} label="" />
          <CardView card={null} label="" />
          <CardView card={KING} label="" />
          <CardView card={SEVEN} label="" />
        </div>
      </DeckStyleContext.Provider>

      <span className="deck-label">{t('deckColor')}</span>
      <div className="swatches deck-colors">
        {BACK_COLORS.map((c) => (
          <label
            key={c}
            className={`swatch${deck.color === c ? ' on' : ''}`}
            style={{ '--swatch': BACK_HEX[c] } as CSSProperties}
            title={t(COLOR_NAME[c])}
          >
            <input
              type="radio"
              name={`${name}-color`}
              checked={deck.color === c}
              onChange={() => set({ color: c })}
              aria-label={t(COLOR_NAME[c])}
            />
          </label>
        ))}
      </div>

      <span className="deck-label">{t('deckPattern')}</span>
      <div className="deck-patterns">
        {PATTERNS.map((p) => (
          <label key={p} className={deck.pattern === p ? 'on' : ''}>
            <input
              type="radio"
              name={`${name}-pattern`}
              checked={deck.pattern === p}
              onChange={() => set({ pattern: p })}
            />
            <DeckStyleContext.Provider value={{ ...deck, pattern: p, effect: 'none' }}>
              <CardView card={null} label="" size="sm" />
            </DeckStyleContext.Provider>
            <span>{t(PATTERN_NAME[p])}</span>
          </label>
        ))}
      </div>

      <label className="deck-mark">
        <span className="deck-label">{t('deckMark')}</span>
        <input
          value={deck.mark}
          onChange={(e) => set({ mark: cleanMark(e.target.value) })}
          maxLength={MAX_MARK * 8}
          autoComplete="off"
          aria-describedby={`${name}-mark-hint`}
        />
        <small className="muted" id={`${name}-mark-hint`}>
          {t('deckMarkHint')}
        </small>
      </label>

      <span className="deck-label">{t('deckEffect')}</span>
      <div className="segmented four">
        {EFFECTS.map((e) => (
          <label key={e} className={deck.effect === e ? 'on' : ''}>
            <input
              type="radio"
              name={`${name}-effect`}
              checked={deck.effect === e}
              onChange={() => set({ effect: e })}
            />
            {t(EFFECT_NAME[e])}
          </label>
        ))}
      </div>
      <small className="muted">{t(EFFECT_HINT[deck.effect])}</small>

      {changed ? (
        <button type="button" className="link deck-reset" onClick={() => updateSettings({ deck: DEFAULT_DECK })}>
          {t('deckReset')}
        </button>
      ) : null}
    </fieldset>
  );
}
