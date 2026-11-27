import { DeckPicker } from '../cards/DeckPicker.tsx';
import { CONTACT } from '../contact.ts';
import { updateSettings, useSettings } from '../feedback/settings.ts';
import { HandPicker } from '../game/HandPicker.tsx';
import { HandWatch } from '../game/HandWatch.tsx';
import { focusOnMount } from '../game/Overlay.tsx';
import { currentLang, languageChoices, setLang, t } from '../i18n/index.ts';
import { install, usePwa } from '../pwa.ts';
import { BUILD } from '../version.ts';

// This device's settings, behind the launch screen's button: language, sounds, vibrations, the hand's layout, how the
// others are watched (the bots' pace, their hands, the cards' speed), and installing the game when the browser offers it.

/**
 * An e-mail to the contact address, written in the player's language and ready to fill (ADR-0028: no native reviewer,
 * so the players are the ones who catch a wrong word). The language and the build say which text they saw.
 */
export function reportHref(name: string): string {
  const subject = t('reportSubject', { lang: name });
  const body = t('reportBody', { lang: name, version: BUILD });
  return `mailto:${CONTACT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

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
        <button type="button" className="ghost" onClick={onClose} ref={focusOnMount}>
          {t('close')}
        </button>
      </div>
      <fieldset className="field">
        <legend>{t('settingsLang')}</legend>
        {/* Each language named in itself, in its own writing (no flags: a flag names a country), as on the site's pages. */}
        <div className="segmented lang-list">
          {languageChoices().map((l) => (
            <label key={l.code} className={lang === l.code ? 'on' : ''} lang={l.html}>
              <input type="radio" name="lang" checked={lang === l.code} onChange={() => void setLang(l.code)} />
              {l.name}
            </label>
          ))}
        </div>
        {lang === 'fr' ? null : (
          <p className="report">
            <a href={reportHref(languageChoices().find((l) => l.code === lang)?.name ?? lang)}>
              {t('reportTranslation')}
            </a>
            <small className="muted">{t('reportTranslationHint')}</small>
          </p>
        )}
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
      <label className="toggle toggle-note">
        <span>
          {t('settingsCountDevice')}
          <small className="muted">{t('settingsCountDeviceHint')}</small>
        </span>
        <input
          type="checkbox"
          checked={settings.countDevice}
          onChange={(e) => updateSettings({ countDevice: e.target.checked })}
        />
      </label>
      <DeckPicker name="deck" />
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
