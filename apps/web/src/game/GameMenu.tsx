import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { t } from '../i18n/index.ts';

// The table's "⋯" menu (the owner's pick A on the 2026-11-24 header canvas): what the top bar no longer holds — the
// pause, the sound, the vibrations, the display, the rules and leaving the game — in a list under the button, so the bar keeps only the
// way out, the round, the journal and this button. Closed by a choice, Escape, or a touch beside it.

const ICONS: Record<
  'pause' | 'sound' | 'muted' | 'haptics' | 'still' | 'display' | 'rules' | 'quit' | 'more',
  ReactNode
> = {
  pause: <path d="M9 5v14M15 5v14" />,
  sound: <path d="M3 10v4h3l7 5V5L6 10H3z M17 9a4 4 0 0 1 0 6" />,
  muted: <path d="M3 10v4h3l7 5V5L6 10H3z M17 9l5 6M22 9l-5 6" />,
  haptics: <path d="M8 4h8v16H8z M4 9v6 M20 9v6" />,
  still: <path d="M8 4h8v16H8z M4 9v6 M20 9v6 M3 3l18 18" />,
  display: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  rules: <path d="M5 4h11l3 3v13H5z M9 10h6 M9 14h6" />,
  quit: <path d="M10 4H5v16h5 M14 8l4 4-4 4 M18 12H9" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </>
  ),
};

export const BarIcon = ({ name }: { name: keyof typeof ICONS }) => (
  <svg className={`bar-icon${name === 'more' ? ' bar-dots' : ''}`} viewBox="0 0 24 24" aria-hidden="true">
    {ICONS[name]}
  </svg>
);

interface Props {
  /** Pausing is offered (this device, or the game master in a room) and the game is not paused yet. */
  canPause: boolean;
  sound: boolean;
  haptics: boolean;
  onPause: () => void;
  onSound: () => void;
  onHaptics: () => void;
  onDisplay: () => void;
  onRules: () => void;
  onQuit: () => void;
}

export function GameMenu({ canPause, sound, haptics, onPause, onSound, onHaptics, onDisplay, onRules, onQuit }: Props) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus();
    const beside = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    // Caught before the table's own Escape (which would drop a choice in progress): here it only closes the menu.
    const onEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('pointerdown', beside);
    window.addEventListener('keydown', onEscape, true);
    return () => {
      document.removeEventListener('pointerdown', beside);
      window.removeEventListener('keydown', onEscape, true);
    };
  }, [open]);

  const pick = (act: () => void) => () => {
    setOpen(false);
    act();
  };

  // Up and down walk the items, as in any menu.
  const walk = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...(list.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    items[(at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  };

  return (
    <div className="bar-menu" ref={wrap}>
      <button
        ref={button}
        type="button"
        className={`bar-btn${open ? ' on' : ''}`}
        aria-label={t('moreOptions')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <BarIcon name="more" />
      </button>
      {open ? (
        <div className="bar-pop" role="menu" aria-label={t('gameMenu')} ref={list} onKeyDown={walk}>
          {canPause ? (
            <button type="button" role="menuitem" onClick={pick(onPause)}>
              <BarIcon name="pause" />
              {t('menuPause')}
            </button>
          ) : null}
          <button type="button" role="menuitemcheckbox" aria-checked={sound} onClick={onSound}>
            <BarIcon name={sound ? 'sound' : 'muted'} />
            {t('menuSound')}
            <small>{t(sound ? 'menuSoundOn' : 'menuSoundOff')}</small>
          </button>
          <button type="button" role="menuitemcheckbox" aria-checked={haptics} onClick={onHaptics}>
            <BarIcon name={haptics ? 'haptics' : 'still'} />
            {t('settingsHaptics')}
            <small>{t(haptics ? 'menuHapticsOn' : 'menuHapticsOff')}</small>
          </button>
          <button type="button" role="menuitem" onClick={pick(onDisplay)}>
            <BarIcon name="display" />
            {t('display')}
          </button>
          <button type="button" role="menuitem" onClick={pick(onRules)}>
            <BarIcon name="rules" />
            {t('rules')}
          </button>
          <hr />
          <button type="button" role="menuitem" className="bar-quit" onClick={pick(onQuit)}>
            <BarIcon name="quit" />
            {t('quitGame')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
