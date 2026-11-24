import { AVATAR_COLORS, AVATAR_ICONS, type Avatar as AvatarValue, MAX_NAME_LENGTH } from '@tamalou/shared';
import { type CSSProperties, useState } from 'react';
import { t } from '../i18n/index.ts';
import { Avatar } from './Avatar.tsx';
import { COLOR_HEX, COLOR_NAME, ICON_NAME, ICON_PATH, type Profile, saveProfile } from './avatar.ts';

// «Mon profil» (the owner's pick ProfilA on the 2026-11-24 canvas): the name, eight colours, twelve icons, the avatar
// drawn large as it changes; «Enregistrer» keeps them on the device. A room in progress keeps the seat it was given.

export function ProfileEditor({
  profile,
  fallback,
  onClose,
  onSaved,
}: {
  profile: Profile;
  /** Shown until the player picks: the avatar a table would give them. */
  fallback: AvatarValue;
  onClose: () => void;
  /** The name kept, for the screens that hold a copy (the last game's setup). */
  onSaved?: (name: string) => void;
}) {
  const [name, setName] = useState(profile.name);
  const [avatar, setAvatar] = useState<AvatarValue>(profile.avatar ?? fallback);
  const save = () => {
    const kept = name.trim() || profile.name;
    saveProfile({ name: kept, avatar });
    if (kept) onSaved?.(kept);
    onClose();
  };
  return (
    <form
      className="profile"
      aria-labelledby="profile-title"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="panel-head">
        <h2 id="profile-title" className="field-title">
          {t('profile')}
        </h2>
        <button type="button" className="ghost" onClick={onClose}>
          {t('close')}
        </button>
      </div>
      <div className="profile-hero">
        <Avatar avatar={avatar} size="lg" />
        <span>
          <b>{name.trim() || t('helloNobody')}</b>
          <small>{t('profileHint')}</small>
        </span>
      </div>
      <label className="field profile-name">
        <span className="field-title">{t('profileName')}</span>
        <input
          value={name}
          maxLength={MAX_NAME_LENGTH}
          autoComplete="nickname"
          onChange={(e) => setName(e.target.value)}
          ref={(el) => {
            if (el && !profile.name) el.focus();
          }}
        />
      </label>
      <fieldset className="field">
        <legend>{t('profileColor')}</legend>
        <div className="swatches">
          {AVATAR_COLORS.map((c) => (
            <label
              key={c}
              className={`swatch${avatar.color === c ? ' on' : ''}`}
              style={{ '--swatch': COLOR_HEX[c] } as CSSProperties}
              title={t(COLOR_NAME[c])}
            >
              <input
                type="radio"
                name="avatar-color"
                checked={avatar.color === c}
                onChange={() => setAvatar({ ...avatar, color: c })}
                aria-label={t(COLOR_NAME[c])}
              />
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="field">
        <legend>{t('profileIcon')}</legend>
        <div className="icon-picks">
          {AVATAR_ICONS.map((i) => (
            <label key={i} className={`icon-pick${avatar.icon === i ? ' on' : ''}`} title={t(ICON_NAME[i])}>
              <input
                type="radio"
                name="avatar-icon"
                checked={avatar.icon === i}
                onChange={() => setAvatar({ ...avatar, icon: i })}
                aria-label={t(ICON_NAME[i])}
              />
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d={ICON_PATH[i]} />
              </svg>
            </label>
          ))}
        </div>
      </fieldset>
      <button type="submit" className="btn btn-primary profile-save">
        {t('profileSave')}
      </button>
      <p className="profile-note muted">{t('profileNote')}</p>
    </form>
  );
}
