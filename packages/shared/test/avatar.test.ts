import { describe, expect, it } from 'vitest';
import { AVATAR_COLORS, AVATAR_ICONS, avatarsFor, parseAvatar, parseClientMessage } from '../src/index.ts';

describe('avatars', () => {
  it('keeps a chosen avatar and gives the others what nobody has yet', () => {
    const map = avatarsFor([
      { id: 'a', avatar: { color: 'blue', icon: 'star' } },
      { id: 'b' },
      { id: 'c', avatar: null },
    ]);
    expect(map.get('a')).toEqual({ color: 'blue', icon: 'star' });
    expect(map.get('b')).toEqual({ color: 'vermilion', icon: 'crown' });
    expect(map.get('c')).toEqual({ color: 'green', icon: 'moon' });
  });

  it('goes round again once every colour and icon is taken, the same way on every screen', () => {
    const seats = Array.from({ length: 10 }, (_, i) => ({ id: `s${i}` }));
    const map = avatarsFor(seats);
    expect(new Set([...map.values()].slice(0, AVATAR_COLORS.length).map((a) => a.color)).size).toBe(
      AVATAR_COLORS.length,
    );
    expect(map.get('s8')?.color).toBe(AVATAR_COLORS[0]);
    expect(map.get('s9')?.icon).toBe(AVATAR_ICONS[4 + (9 % 8)]);
    expect(avatarsFor(seats)).toEqual(map);
  });

  it('reads only a known colour and icon', () => {
    expect(parseAvatar({ color: 'teal', icon: 'note' })).toEqual({ color: 'teal', icon: 'note' });
    expect(parseAvatar({ color: 'pink', icon: 'note' })).toBeNull();
    expect(parseAvatar('blue')).toBeNull();
    expect(parseClientMessage('{"t":"setName","name":"Léa","avatar":{"color":"rose","icon":"sun"}}')).toEqual({
      t: 'setName',
      name: 'Léa',
      avatar: { color: 'rose', icon: 'sun' },
    });
    expect(parseClientMessage('{"t":"setName","name":"Léa","avatar":{"color":"x","icon":"sun"}}')).toBeNull();
  });
});
