import { updateSettings, useSettings } from '../feedback/settings.ts';
import { t } from '../i18n/index.ts';
import { DRAW_VIEWS, type DrawView } from './front.ts';
import { CARD_SPEEDS, type CardSpeed, handKind, PACES, type Pace } from './pace.ts';

// How the table is watched (the owner's picks on the 2026-10-24 and 2026-10-25 canvases), on the home screen's
// settings and behind the table's "Affichage" button: how my drawn card shows, the bots' pace, their hands, and how
// fast the cards go. Settings of this device: a room's bots keep their own pace.

const PACE_LABEL = { fast: 'paceFast', normal: 'paceNormal', slow: 'paceSlow' } as const satisfies Record<Pace, string>;
const PACE_HINT = {
  fast: 'paceFastHint',
  normal: 'paceNormalHint',
  slow: 'paceSlowHint',
} as const satisfies Record<Pace, string>;
const SPEED_LABEL = {
  fast: 'speedFast',
  normal: 'speedNormal',
  soft: 'speedSoft',
} as const satisfies Record<CardSpeed, string>;
const DRAW_LABEL = { held: 'drawViewHeld', big: 'drawViewBig' } as const satisfies Record<DrawView, string>;
const DRAW_HINT = { held: 'drawViewHeldHint', big: 'drawViewBigHint' } as const satisfies Record<DrawView, string>;

export function HandWatch({ name }: { name: string }) {
  const settings = useSettings();
  return (
    <>
      <fieldset className="field">
        <legend>{t('drawView')}</legend>
        <div className="segmented">
          {DRAW_VIEWS.map((view) => (
            <label key={view} className={settings.drawView === view ? 'on' : ''}>
              <input
                type="radio"
                name={`${name}-draw`}
                checked={settings.drawView === view}
                onChange={() => updateSettings({ drawView: view })}
              />
              {t(DRAW_LABEL[view])}
            </label>
          ))}
        </div>
        <small className="muted">{t(DRAW_HINT[settings.drawView])}</small>
      </fieldset>
      <fieldset className="field">
        <legend>{t('botPace')}</legend>
        <div className="segmented">
          {PACES.map((pace) => (
            <label key={pace} className={settings.botPace === pace ? 'on' : ''}>
              <input
                type="radio"
                name={`${name}-pace`}
                checked={settings.botPace === pace}
                onChange={() => updateSettings({ botPace: pace })}
              />
              {t(PACE_LABEL[pace])}
            </label>
          ))}
        </div>
        <small className="muted">{t(PACE_HINT[settings.botPace])}</small>
      </fieldset>
      <label className="toggle">
        <span>{t('showHands')}</span>
        <input
          type="checkbox"
          checked={settings.showHands}
          onChange={(e) => updateSettings({ showHands: e.target.checked })}
        />
      </label>
      <small className="muted">{t(handKind() === 'cursor' ? 'showHandsCursor' : 'showHandsFinger')}</small>
      <fieldset className="field">
        <legend>{t('cardSpeed')}</legend>
        <div className="segmented">
          {CARD_SPEEDS.map((speed) => (
            <label key={speed} className={settings.cardSpeed === speed ? 'on' : ''}>
              <input
                type="radio"
                name={`${name}-speed`}
                checked={settings.cardSpeed === speed}
                onChange={() => updateSettings({ cardSpeed: speed })}
              />
              {t(SPEED_LABEL[speed])}
            </label>
          ))}
        </div>
        <small className="muted">{t('cardSpeedHint')}</small>
      </fieldset>
    </>
  );
}
