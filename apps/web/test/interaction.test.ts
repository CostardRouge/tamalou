import { apply, createGame, type GameState, viewFor } from '@tamalou/engine';
import { type Action, parseRules, type RuleSet } from '@tamalou/shared';
import { describe, expect, it } from 'vitest';
import { interaction, NONE } from '../src/game/interaction.ts';

const noPeek = parseRules({ hand: { initialPeek: { count: 0 } } });

function game(rules: RuleSet = noPeek) {
  return createGame({
    seed: 11,
    players: [
      { id: 'me', name: 'Moi' },
      { id: 'bot', name: 'Ada' },
    ],
    rules,
  }).state;
}
const act = (s: GameState, a: Action, rules: RuleSet = noPeek) => {
  const r = apply(s, a, rules);
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
/** Plays draws and discards until the card on top is one with the wanted power, or gives up. */
function withPower(power: string, rules: RuleSet = noPeek) {
  for (let seed = 1; seed < 400; seed++) {
    let s = createGame({
      seed,
      players: [
        { id: 'me', name: 'Moi' },
        { id: 'bot', name: 'Ada' },
      ],
      rules,
    }).state;
    s = act(s, { type: 'draw', by: 'me', from: 'deck' }, rules);
    const card = s.cards[s.drawn?.card ?? -1];
    if (card && rules.powers.byRank[card.rank] === power) return act(s, { type: 'discardDrawn', by: 'me' }, rules);
  }
  throw new Error(`no ${power}`);
}

describe('table interaction', () => {
  it('offers my cards for a swap once I hold a drawn card, and nothing else', () => {
    const s = act(game(), { type: 'draw', by: 'me', from: 'deck' });
    const ui = interaction(viewFor(s, 'me', noPeek), noPeek, NONE);
    expect(ui.slot({ player: 'me', slot: 2 })?.send).toEqual({ type: 'swap', by: 'me', slot: 2 });
    expect(ui.slot({ player: 'bot', slot: 0 })).toBeNull();
    expect(ui.find('discardDrawn')).toBeTruthy();
  });

  it('takes a blind swap in two touches: mine, then theirs', () => {
    const s = withPower('blindSwap');
    const view = viewFor(s, 'me', noPeek);
    const first = interaction(view, noPeek, NONE).slot({ player: 'me', slot: 1 });
    expect(first?.next).toEqual({ kind: 'blindOwn', own: 1 });
    const second = interaction(view, noPeek, { kind: 'blindOwn', own: 1 }).slot({ player: 'bot', slot: 3 });
    expect(second?.send).toMatchObject({
      type: 'usePower',
      targets: [
        { player: 'me', slot: 1 },
        { player: 'bot', slot: 3 },
      ],
    });
  });

  it('peeks with one touch on the right side', () => {
    const s = withPower('peekOther');
    const ui = interaction(viewFor(s, 'me', noPeek), noPeek, NONE);
    expect(ui.slot({ player: 'me', slot: 0 })).toBeNull();
    expect(ui.slot({ player: 'bot', slot: 0 })?.send).toMatchObject({ type: 'usePower' });
  });

  it('arms a quick discard, then claims the touched card', () => {
    const s = game();
    const view = viewFor(s, 'bot', noPeek);
    const ui = interaction(view, noPeek, NONE);
    expect(ui.canQuick).toBe(true);
    expect(ui.slot({ player: 'bot', slot: 0 })).toBeNull();
    const armed = interaction(view, noPeek, { kind: 'quick' });
    expect(armed.slot({ player: 'bot', slot: 0 })?.send).toMatchObject({ type: 'quickDiscard', target: { slot: 0 } });
  });

  it('collects the initial peek in choose mode', () => {
    const rules = parseRules({ hand: { initialPeek: { mode: 'choose', count: 2 } } });
    const view = viewFor(game(rules), 'me', rules);
    const one = interaction(view, rules, NONE).slot({ player: 'me', slot: 0 });
    expect(one?.next).toEqual({ kind: 'choosePeek', slots: [0] });
    const two = interaction(view, rules, { kind: 'choosePeek', slots: [0] }).slot({ player: 'me', slot: 3 });
    expect(two?.next).toEqual({ kind: 'choosePeek', slots: [0, 3] });
    const three = interaction(view, rules, { kind: 'choosePeek', slots: [0, 3] }).slot({ player: 'me', slot: 1 });
    expect(three).toBeNull();
  });
});
