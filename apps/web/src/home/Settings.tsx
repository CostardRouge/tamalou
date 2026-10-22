import { updateSettings, useSettings } from '../feedback/settings.ts';
import { HandPicker } from '../game/HandPicker.tsx';
import { currentLang, LANGS, type Lang, setLang, t } from '../i18n/index.ts';
import { install, usePwa } from '../pwa.ts';

// The home screen's last block: language, sounds, vibrations, the hand's layout, and installing the game when the
// browser offers it.

const LANG_KEY = { fr: 'langFr', en: 'langEn' } as const;

export function Settings() {
  const settings = useSettings();
  const { canInstall, installed, iosHint } = usePwa();
  const lang = currentLang();
  return (
    <section className="settings" aria-labelledby="settings-title">
      <h2 id="settings-title" className="field-title">
        {t('settings')}
      </h2>
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
      <p className="legal-link">
        <a href={t('legalHref')}>{t('legalLink')}</a>
      </p>
    </section>
  );
}
