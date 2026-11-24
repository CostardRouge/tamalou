import { type Avatar, type AvatarColor, type AvatarIcon, parseAvatar } from '@tamalou/shared';
import { useSyncExternalStore } from 'react';
import { rememberedName, rememberName } from '../home/name.ts';
import type { Key } from '../i18n/index.ts';

// The profile this device plays under (the owner's picks on the 2026-11-24 canvas, ProfilA and ProfilB): the name kept
// by home/name.ts and an avatar, a colour and an icon, kept here. Both stay on the device; a room receives them when
// this device sits down, to show the player to the others. Until one is chosen, the table gives one (avatarsFor).

const KEY = 'tamalou-avatar';

export const COLOR_HEX: Record<AvatarColor, string> = {
  blue: '#2743f5',
  vermilion: '#d9401f',
  green: '#16855a',
  violet: '#8a3ff0',
  ochre: '#a8740c',
  teal: '#0e8597',
  rose: '#d1306f',
  slate: '#4a5265',
};

export const COLOR_NAME: Record<AvatarColor, Key> = {
  blue: 'avatarBlue',
  vermilion: 'avatarVermilion',
  green: 'avatarGreen',
  violet: 'avatarViolet',
  ochre: 'avatarOchre',
  teal: 'avatarTeal',
  rose: 'avatarRose',
  slate: 'avatarSlate',
};

export const ICON_PATH: Record<AvatarIcon, string> = {
  spade: 'M12 3C9 7 5 9 5 13a3.5 3.5 0 0 0 6 2.5L10 20h4l-1-4.5A3.5 3.5 0 0 0 19 13c0-4-4-6-7-10z',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  diamond: 'M12 3l6 9-6 9-6-9z',
  club: 'M12 4a3 3 0 0 1 2.6 4.5A3 3 0 1 1 13 14l1 6h-4l1-6a3 3 0 1 1-1.6-5.5A3 3 0 0 1 12 4z',
  star: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z',
  crown: 'M4 18h16l1-10-5 4-4-6-4 6-5-4z',
  moon: 'M15 3a8 8 0 1 0 6 13A7 7 0 0 1 15 3z',
  sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM11 1h2v4h-2zM11 19h2v4h-2zM1 11h4v2H1zM19 11h4v2h-4zM4.2 5.6l1.4-1.4 2.8 2.8-1.4 1.4zM15.6 17l1.4-1.4 2.8 2.8-1.4 1.4zM4.2 18.4 7 15.6l1.4 1.4-2.8 2.8zM15.6 7l2.8-2.8 1.4 1.4L17 8.4z',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7l1-8z',
  leaf: 'M5 19C5 9 11 4 20 4c0 9-5 15-15 15z',
  drop: 'M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z',
  note: 'M9 18a3 3 0 1 1-2-2.8V5l10-2v11a3 3 0 1 1-2-2.8V6l-6 1.2z',
};

export const ICON_NAME: Record<AvatarIcon, Key> = {
  spade: 'avatarSpade',
  heart: 'avatarHeart',
  diamond: 'avatarDiamond',
  club: 'avatarClub',
  star: 'avatarStar',
  crown: 'avatarCrown',
  moon: 'avatarMoon',
  sun: 'avatarSun',
  bolt: 'avatarBolt',
  leaf: 'avatarLeaf',
  drop: 'avatarDrop',
  note: 'avatarNote',
};

/** The avatar chosen on this device, or null before one is. */
export function rememberedAvatar(): Avatar | null {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return raw ? parseAvatar(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export interface Profile {
  name: string;
  avatar: Avatar | null;
}

let current: Profile | null = null;
const listeners = new Set<() => void>();

function read(): Profile {
  current ??= { name: rememberedName(), avatar: rememberedAvatar() };
  return current;
}

/** Keeps the name and the avatar on this device, and tells the screens. */
export function saveProfile(p: { name: string; avatar: Avatar }): void {
  rememberName(p.name);
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(p.avatar));
  } catch {
    // Storage refused: the avatar lasts as long as the page.
  }
  current = { name: rememberedName() || p.name.trim(), avatar: p.avatar };
  for (const fn of listeners) fn();
}

/** Forgets what was read, after the name changed elsewhere (a room joined under a new name). */
export function refreshProfile(): void {
  current = null;
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useProfile(): Profile {
  return useSyncExternalStore(subscribe, read, read);
}
