import { apply, createGame, type GameState, viewFor } from '@tamalou/engine';
import { type Action, parseRules } from '@tamalou/shared';
import { describe, expect, it } from 'vitest';
import { confirmQuestion } from '../src/game/confirm.ts';
import { dropsFor } from '../src/game/drag.ts';
import { bubblesOf, flightsOf } from '../src/game/flights.ts';
import { interaction, NONE } from '../src/game/interaction.ts';
import { describeEvent } from '../src/game/log.ts';

// Taking an opponent's card in a quick discard, then giving them one of mine (the owner, 2026-11-21): the claim goes
// in one touch, the card I give is chosen once it has gone through.

const rules = parseRules({ hand: { initialPeek: { count: 0 } }, quickDiscard: { onDealtCard: true } });
const nameOf = (id: string) => (id === 'ada' ? 'Ada' : 'Moi');

/** A table where Ada's first card matches the discard's top, and the window is open on it. */
function table(): GameState {
  const s = structuredClone(
    createGame({
      seed: 11,
      players: [
        { id: 'me', name: 'Moi' },
        { id: 'ada', name: 'Ada' },
      ],
      rules,
    }).state,
  );
  const top = s.discard.at(-1) as number;
  const twin = s.deck.findIndex((id) => s.cards[id]?.rank === s.cards[top]?.rank);
  const [mine] = s.deck.splice(twin, 1, s.hands.ada?.[0] as number);
  (s.hands.ada as number[])[0] = mine as number;
  return s;
}
const act = (s: GameState, a: Action) => {
  const r = apply(s, a, rules);
  if (!r.ok) throw new Error(r.error);
  return r;
};

describe('a card given after a quick discard on an opponent’s', () => {
  it('claims the opponent’s card in one touch, by the bolt or by dragging it onto the discard', () => {
    const s = table();
    const view = viewFor(s, 'me', rules);
    const claim = interaction(view, rules, { kind: 'quick' }).slot({ player: 'ada', slot: 0 });
    expect(claim?.send).toMatchObject({ type: 'quickDiscard', target: { player: 'ada', slot: 0 } });
    expect(claim?.next).toBeUndefined();
    const ui = interaction(view, rules, NONE);
    const drops = dropsFor({ kind: 'slot', ref: { player: 'ada', slot: 0 } }, ui, view);
    expect(drops).toMatchObject([{ place: 'discard', send: { type: 'quickDiscard' } }]);
    expect(confirmQuestion(claim?.send as Action, view, nameOf)).toBe('Poser la carte 1 de Ada sur la défausse ?');
  });

  it('then gives one of mine with a touch or a drag onto the emptied slot, the table waiting meanwhile', () => {
    const s = table();
    const top = s.discard.at(-1) as number;
    const claimed = act(s, { type: 'quickDiscard', by: 'me', target: { player: 'ada', slot: 0 }, expectTop: top });
    const view = viewFor(claimed.state, 'me', rules);
    expect(view.owedGive).toEqual({ player: 'me', to: { player: 'ada', slot: 0 } });
    const ui = interaction(view, rules, NONE);
    const give = ui.slot({ player: 'me', slot: 2 })?.send;
    expect(give).toEqual({ type: 'giveCard', by: 'me', slot: 2 });
    expect(dropsFor({ kind: 'slot', ref: { player: 'me', slot: 2 } }, ui, view)).toMatchObject([
      { place: 'slot:ada:0', send: { type: 'giveCard', slot: 2 } },
    ]);
    expect(confirmQuestion(give as Action, view, nameOf)).toBe('Donner ta carte 3 à Ada ?');
    // Ada can do nothing until then.
    expect(interaction(viewFor(claimed.state, 'ada', rules), rules, NONE).legal).toEqual([]);

    const given = act(claimed.state, give as Action);
    const event = given.events[0];
    expect(event).toEqual({ type: 'cardGiven', player: 'me', slot: 2, into: { player: 'ada', slot: 0 } });
    if (!event) return;
    expect(describeEvent(event, nameOf, 'me')).toBe('Tu donnes une carte à Ada.');
    expect(describeEvent(event, nameOf, 'ada')).toBe('Moi te donne une carte.');
    expect(flightsOf([event], 'ada')).toMatchObject([{ from: 'slot:me:2', to: 'slot:ada:0', card: null }]);
    expect(bubblesOf([event], 'ada')).toMatchObject([{ player: 'me', key: 'bubbleGiveYou' }]);
  });
});
