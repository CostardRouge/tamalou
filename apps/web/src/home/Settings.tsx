import { updateSettings, useSettings } from '../feedback/settings.ts';
import { HandPicker } from '../game/HandPicker.tsx';
import { HandWatch } from '../game/HandWatch.tsx';
import { currentLang, LANGS, type Lang, setLang, t } from '../i18n/index.ts';
import { install, usePwa } from '../pwa.ts';

// This device's settings, behind the launch screen's button: language, sounds, vibrations, the hand's layout, how the
// others are watched (the bots' pace, their hands, the cards' speed), and installing the game when the browser offers it.

const LANG_KEY = { fr: 'langFr', en: 'langEn' } as const;

export function Settings({ onClose }: { onClose: () => void }) {
  const settings = useSettings();
  const { canInstall, installed, iosHint } = usePwa();
  const lang = currentLang();
  return (
    <section className="settings" aria-labelledby="settings-title">
      <div className="panel-head">
        <h2 id="settings-title" className="field-title">
          {t('settings')}
        </h2>
        <button type="button" className="ghost" onClick={onClose} ref={(el) => el?.focus()}>
          {t('close')}
        </button>
      </div>
      <fieldset className="field">
        <legend>{t('settingsLang')}</legend>
        <div className="segmented two">
          {LANGS.map((l: Lang) => (
            <label key={l} className={lang === l ? 'on' : ''} lang={l}>
              <input type="radio" name="lang" checked={lang === l} onChange={() => setLang(l)} />
              {t(LANG_KEY[l])}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="toggle">
        <span>{t('settingsSound')}</span>
        <input type="checkbox" checked={settings.sound} onChange={(e) => updateSettings({ sound: e.target.checked })} />
      </label>
      {'vibrate' in navigator ? (
        <label className="toggle">
          <span>{t('settingsHaptics')}</span>
          <input
            type="checkbox"
            checked={settings.haptics}
            onChange={(e) => updateSettings({ haptics: e.target.checked })}
          />
        </label>
      ) : null}
      <HandPicker name="hand" />
      <HandWatch name="watch" />
      {canInstall ? (
        <div className="install">
          <button type="button" className="btn btn-secondary" onClick={() => void install()}>
            {t('install')}
          </button>
          <small className="muted">{t('installHint')}</small>
        </div>
      ) : installed ? (
        <p className="install" role="status">
          <small className="muted">{t('installed')}</small>
        </p>
      ) : iosHint ? (
        <p className="install">
          <small className="muted">{t('installIos')}</small>
        </p>
      ) : null}
    </section>
  );
}
