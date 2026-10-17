import type { Card, CardId, PlayerId, PlayerView, RuleSet, SlotView } from '@tamalou/shared';
import { cardOf, type GameState, isLocked, topOfDiscard } from './state.ts';

// The only way out of the engine for a player: everything they may know, nothing more. A card face is put in the view
// only when one of these holds for `me`: it is the discard's top; it is my initial peek (until I am ready); it is the
// card I hold or am looking at; the round is over and every hand is shown; beginner mode and I have seen it.
// tests/view.property.test.ts checks the view against the events each player was sent.

export function viewFor(s: GameState, me: PlayerId, rules: RuleSet): PlayerView {
  const face = (id: CardId): Card => cardOf(s, id);
  const roundShown = s.phase === 'roundOver' || s.phase === 'gameOver';
  const myPeek = s.peek[me];
  const knows = new Set(s.knows[me] ?? []);

  const visible = (owner: PlayerId, slot: number, id: CardId): boolean => {
    if (roundShown) return true;
    if (s.phase === 'initialPeek' && owner === me && myPeek && !myPeek.ready && myPeek.slots?.includes(slot)) {
      return true;
    }
    if (s.reveal && s.reveal.player === me && s.reveal.target.player === owner && s.reveal.target.slot === slot) {
      return true;
    }
    return rules.assist.showKnownCards && knows.has(id);
  };

  const players = s.players.map((p) => {
    const slots: SlotView[] = (s.hands[p.id] ?? []).map((id, slot) => ({
      slot,
      filled: id !== null,
      card: id !== null && visible(p.id, slot, id) ? face(id) : null,
      locked: isLocked(s, rules.tamalou.lockCallerCards, { player: p.id, slot }, me),
    }));
    return { id: p.id, name: p.name, total: p.total, eliminated: p.eliminated, slots };
  });

  const top = topOfDiscard(s);
  return {
    me,
    round: s.round,
    phase: s.phase,
    step: s.step,
    current: s.current,
    players,
    deckSize: s.deck.length,
    discardSize: s.discard.length,
    discardTop: top === null ? null : face(top),
    drawn: s.drawn
      ? {
          from: s.drawn.from,
          // From the discard the card was public anyway; from the pile only its holder sees it.
          card: s.current === me || s.drawn.from === 'discard' ? face(s.drawn.card) : null,
        }
      : null,
    pendingPower: s.pendingPower ? { ...s.pendingPower } : null,
    reveal: s.reveal
      ? {
          player: s.reveal.player,
          power: s.reveal.power,
          target: { ...s.reveal.target },
          card: s.reveal.player === me ? face(s.reveal.card) : null,
        }
      : null,
    quickDiscardOpen: rules.quickDiscard.enabled && s.window,
    caller: s.caller,
    lastTurns: [...s.lastTurns],
    ready: s.players.filter((p) => s.peek[p.id]?.ready).map((p) => p.id),
    myPeekSlots: myPeek?.slots ? [...myPeek.slots] : null,
    myTurns: s.turns[me] ?? 0,
    lastResult: s.results[s.results.length - 1] ?? null,
    winners: s.winners ? [...s.winners] : null,
  };
}
