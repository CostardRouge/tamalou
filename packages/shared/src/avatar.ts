import { z } from 'zod';
import type { PlayerId } from './actions.ts';

// A player's avatar (the owner's picks on the 2026-11-24 canvas): a colour and an icon, chosen on the device and
// shown wherever the player is named (their seat, the lobby, the band). It is presentation only: the engine never
// reads it. A seat without one (a bot, an older client) is given one here, from its place at the table, so every
// screen draws the same table the same way.

export const AVATAR_COLORS = ['blue', 'vermilion', 'green', 'violet', 'ochre', 'teal', 'rose', 'slate'] as const;
export const AVATAR_ICONS = [
  'spade',
  'heart',
  'diamond',
  'club',
  'star',
  'crown',
  'moon',
  'sun',
  'bolt',
  'leaf',
  'drop',
  'note',
] as const;

export type AvatarColor = (typeof AVATAR_COLORS)[number];
export type AvatarIcon = (typeof AVATAR_ICONS)[number];

export const AvatarSchema = z.object({ color: z.enum(AVATAR_COLORS), icon: z.enum(AVATAR_ICONS) });
export type Avatar = z.infer<typeof AvatarSchema>;

/** A stored or received avatar, or null when it is not one. */
export function parseAvatar(raw: unknown): Avatar | null {
  const parsed = AvatarSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** The icons a seat is given when it chose none: not the suits, which the cards already show. */
const GIVEN_ICONS = AVATAR_ICONS.slice(4);

/**
 * Every seat's avatar, in seat order: a chosen one is kept; the others take, in turn, the first colour and icon nobody
 * at the table has yet (once all are taken, they go round again from the seat's place).
 */
export function avatarsFor(
  seats: readonly { id: PlayerId; avatar?: Avatar | null | undefined }[],
): Map<PlayerId, Avatar> {
  const colors = new Set<AvatarColor>();
  const icons = new Set<AvatarIcon>();
  for (const s of seats) {
    if (!s.avatar) continue;
    colors.add(s.avatar.color);
    icons.add(s.avatar.icon);
  }
  const out = new Map<PlayerId, Avatar>();
  seats.forEach((s, i) => {
    if (s.avatar) {
      out.set(s.id, s.avatar);
      return;
    }
    const color = AVATAR_COLORS.find((c) => !colors.has(c)) ?? (AVATAR_COLORS[i % AVATAR_COLORS.length] as AvatarColor);
    const icon = GIVEN_ICONS.find((c) => !icons.has(c)) ?? (GIVEN_ICONS[i % GIVEN_ICONS.length] as AvatarIcon);
    colors.add(color);
    icons.add(icon);
    out.set(s.id, { color, icon });
  });
  return out;
}
