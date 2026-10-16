import { describe, expect, it } from 'vitest';
import {
  checkRulesChoice,
  MAX_MESSAGE_LENGTH,
  newRoomCode,
  normalizeRoomCode,
  parseClientMessage,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
} from '../src/index.ts';

describe('room codes', () => {
  it('draws codes from an alphabet without look-alike characters', () => {
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[IO01]/);
    let n = 0;
    const code = newRoomCode(() => (n++ * 0.37) % 1);
    expect(code).toHaveLength(ROOM_CODE_LENGTH);
    expect(normalizeRoomCode(code)).toBe(code);
  });

  it('reads a code as typed', () => {
    expect(normalizeRoomCode(' abc-de ')).toBe('ABCDE');
    expect(normalizeRoomCode('ABCD')).toBeNull();
    expect(normalizeRoomCode('ABCD0')).toBeNull();
  });
});

describe('client messages', () => {
  it('parses known messages and refuses the rest', () => {
    expect(parseClientMessage('{"t":"hello","v":1,"name":"  Léa "}')).toEqual({ t: 'hello', v: 1, name: 'Léa' });
    expect(parseClientMessage('{"t":"action","action":{"type":"draw","from":"deck"}}')).toEqual({
      t: 'action',
      action: { type: 'draw', from: 'deck' },
    });
    expect(parseClientMessage('{"t":"action","action":{"type":"draw","from":"sky"}}')).toBeNull();
    expect(parseClientMessage('{"t":"hello","v":1,"name":""}')).toBeNull();
    expect(parseClientMessage('{"t":"nope"}')).toBeNull();
    expect(parseClientMessage('not json')).toBeNull();
    expect(parseClientMessage(`{"t":"ping","pad":"${'x'.repeat(MAX_MESSAGE_LENGTH)}"}`)).toBeNull();
  });

  it('drops the by of an action: the server fills it in', () => {
    const msg = parseClientMessage('{"t":"action","action":{"type":"ready","by":"someone"}}');
    expect(msg).toEqual({ t: 'action', action: { type: 'ready' } });
  });
});

describe('a rules choice from elsewhere', () => {
  it('keeps a playable choice as its smallest diff', () => {
    expect(checkRulesChoice({ preset: 'classic', overrides: { hand: { size: 4 }, junk: true } })).toEqual({
      preset: 'classic',
      overrides: {},
    });
  });

  it('refuses unknown presets, invalid rules and garbage', () => {
    expect(checkRulesChoice({ preset: 'nope', overrides: {} })).toBeNull();
    expect(checkRulesChoice({ preset: 'classic', overrides: { hand: { size: 0 } } })).toBeNull();
    expect(checkRulesChoice({ preset: 'classic', overrides: [] })).toBeNull();
    expect(checkRulesChoice('classic')).toBeNull();
  });
});
