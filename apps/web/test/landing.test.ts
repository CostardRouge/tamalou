import { handValue } from '@tamalou/engine';
import { type Card, parseRules } from '@tamalou/shared';
import { describe, expect, it } from 'vitest';
import { HANDS, question } from '../src/landing/quiz.tsx';
import { cardWords, LANDING } from '../src/landing/text.ts';
import { freshTut, pointsOf, step, type TAction, type Tut, tappableMine, total } from '../src/landing/tutorial.ts';

// The home page's first round and hand quiz (ADR-0016): their values are the game's default ones, a sensible player
// wins the round and meets every move on the way, and nothing a visitor taps out of turn moves the round.

const rules = parseRules({});
const cardValue = (c: Pick<Card, 'rank' | 'suit'>) => handValue([{ ...c, id: 0, deck: 0 }], rules);

/** Plays actions, following every timed step at once, as the page would after its pauses. */
function play(s: Tut, ...actions: TAction[]): Tut {
  let state = s;
  for (const a of actions) {
    let r = step(state, a);
    while (r.after) r = step(r.state, r.after.action);
    state = r.state;
  }
  return state;
}

describe('the first round', () => {
  it('counts cards as the default rules do', () => {
    const s = freshTut();
    for (const c of [...s.you, ...s.bot, ...s.deck, ...s.disc]) {
      if (c) expect(pointsOf(c), `${c.rank}${c.suit}`).toBe(cardValue(c));
    }
  });

  it('teaches all seven moves to a sensible player, who wins', () => {
    let s = freshTut();
    expect(tappableMine(s)).toEqual([2, 3]);
    s = play(s, { t: 'tapMine', i: 2 }, { t: 'tapMine', i: 3 });
    expect(s.phase).toBe('turn');
    expect(s.peek).toEqual([false, false, false, false]);
    // Turn 1: a 2, kept in place of the unknown top right card (a Queen).
    s = play(s, { t: 'draw', from: 'deck' });
    expect(s.held?.rank).toBe('2');
    s = play(s, { t: 'tapMine', i: 1 });
    // Malo threw a 10; turn 2: a 7, discarded for its power, used on the top left card (an 8).
    expect(s.phase).toBe('turn');
    s = play(s, { t: 'draw', from: 'deck' }, { t: 'discard' });
    expect(s.phase).toBe('powerOwn');
    s = play(s, { t: 'tapMine', i: 0 });
    // Turn 3: a 5 swapped for that 8.
    s = play(s, { t: 'draw', from: 'deck' }, { t: 'tapMine', i: 0 });
    // Turn 4: the call. Malo's last turn keeps a 4: 10 against 12.
    s = play(s, { t: 'tamalou' });
    expect(s.phase).toBe('end');
    expect(total(s.you)).toBeLessThan(total(s.bot));
    expect(s.learned.sort()).toEqual(['discard', 'draw', 'peek', 'power', 'swap', 'tamalou'].sort());
  });

  it('offers a quick discard when Malo throws a rank you know you hold', () => {
    let s = play(freshTut(), { t: 'tapMine', i: 2 }, { t: 'tapMine', i: 3 });
    // Keep the top left 8 known (power of the 7 on turn 2), then wait for Malo's 8.
    s = play(s, { t: 'draw', from: 'deck' }, { t: 'tapMine', i: 1 });
    s = play(s, { t: 'draw', from: 'deck' }, { t: 'discard' }, { t: 'tapMine', i: 0 });
    s = play(s, { t: 'draw', from: 'deck' }, { t: 'tapMine', i: 2 });
    s = play(s, { t: 'draw', from: 'deck' }, { t: 'discard' });
    expect(s.phase).toBe('quick');
    s = play(s, { t: 'tapMine', i: 0 });
    expect(s.you[0]).toBeNull();
    expect(s.learned).toContain('quick');
    expect(s.phase).toBe('turn');
  });

  it('ignores taps that are not a move', () => {
    const s = freshTut();
    expect(step(s, { t: 'tapMine', i: 0 }).state).toBe(s);
    expect(step(s, { t: 'tapBot', i: 0 }).state).toBe(s);
    expect(step(s, { t: 'discard' }).state).toBe(s);
    expect(step(s, { t: 'tamalou' }).state).toBe(s);
    const turn1 = play(s, { t: 'tapMine', i: 2 }, { t: 'tapMine', i: 3 });
    // The call waits for the second turn.
    expect(step(turn1, { t: 'tamalou' }).state).toBe(turn1);
  });
});

describe('the hand quiz', () => {
  it('asks for the true total, with three different answers', () => {
    HANDS.forEach((_, i) => {
      const q = question(i);
      expect(q.sum).toBe(q.hand.reduce((t, c) => t + cardValue(c), 0));
      expect(q.choices).toContain(q.sum);
      expect(new Set(q.choices).size).toBe(3);
    });
  });

  it('names cards in a sentence in both languages', () => {
    expect(cardWords(LANDING.fr, { rank: 'K', suit: 'H' })).toBe('un Roi rouge');
    expect(cardWords(LANDING.fr, { rank: 'Q', suit: 'S' })).toBe('une Dame');
    expect(cardWords(LANDING.en, { rank: '8', suit: 'S' })).toBe('an 8');
    expect(cardWords(LANDING.en, { rank: 'A', suit: 'S' })).toBe('an ace');
    expect(cardWords(LANDING.en, { rank: 'K', suit: 'C' })).toBe('a black King');
  });
});
