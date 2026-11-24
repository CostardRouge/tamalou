import type { Avatar as AvatarValue } from '@tamalou/shared';
import type { CSSProperties } from 'react';
import { COLOR_HEX, ICON_PATH } from './avatar.ts';

/** A player's avatar: their icon on their colour. Decorative: the name beside it says who it is. */
export function Avatar({ avatar, size = 'sm' }: { avatar: AvatarValue; size?: 'xs' | 'sm' | 'md' | 'lg' }) {
  return (
    <span
      className={`avatar avatar-${size}`}
      style={{ '--avatar': COLOR_HEX[avatar.color] } as CSSProperties}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={ICON_PATH[avatar.icon]} />
      </svg>
    </span>
  );
}
