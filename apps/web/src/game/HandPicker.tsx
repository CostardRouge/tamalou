import { CardView } from '../cards/CardView.tsx';
import { updateSettings, useSettings } from '../feedback/settings.ts';
import { t } from '../i18n/index.ts';
import { DEFAULT_HAND, HAND_LAYOUTS, type HandLayout, handFrame, slotStyle } from './hand.ts';

// The choice of my hand's layout, on the home screen's settings and behind the table's "Affichage" button: one tile
// per layout, each drawn with the layout's own styles and four card backs from the card theme, so a tile is the hand
// in small. The opponents follow it unless the player says otherwise.

const LABEL = {
  grid: 'hand_grid',
  row: 'hand_row',
  flat: 'hand_flat',
  arc: 'hand_arc',
  fan: 'hand_fan',
  carousel: 'hand_carousel',
} as const satisfies Record<HandLayout, string>;

export function HandPicker({ name }: { name: string }) {
  const settings = useSettings();
  return (
    <fieldset className="field hand-picker">
      <legend>{t('handLayout')}</legend>
      <div className="hand-choices">
        {HAND_LAYOUTS.map((layout) => (
          <label key={layout} className={settings.hand === layout ? 'on' : ''}>
            <input
              type="radio"
              name={name}
              checked={settings.hand === layout}
              onChange={() => updateSettings({ hand: layout })}
            />
            <MiniHand layout={layout} />
            <span>{t(LABEL[layout])}</span>
            {layout === DEFAULT_HAND ? <small>{t('handDefault')}</small> : null}
          </label>
        ))}
      </div>
      <label className="toggle">
        <span>{t('handOpponents')}</span>
        <input
          type="checkbox"
          checked={settings.oppHand}
          onChange={(e) => updateSettings({ oppHand: e.target.checked })}
        />
      </label>
      <small className="muted">{t('handHint')}</small>
    </fieldset>
  );
}

function MiniHand({ layout }: { layout: HandLayout }) {
  const frame = handFrame(layout, 4, 2);
  return (
    <span className="hand-preview" aria-hidden="true">
      <span className={`hand-mini ${frame.className}`} style={frame.style}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="slot" style={slotStyle(i, 4)}>
            <CardView card={null} label="" size="sm" />
          </span>
        ))}
      </span>
    </span>
  );
}
