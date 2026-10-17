import type { Card, Rank, Suit } from '@tamalou/shared';
import { useState } from 'react';
import { trackEvent } from '../audience.ts';
import { CardView } from '../cards/CardView.tsx';
import { cardWords, fill, type LandingText } from './text.ts';
import { pointsOf } from './tutorial.ts';

// "What is this hand worth?" (the owner's pick from direction C, placed under the first round): four face-up cards,
// three totals to choose from, and a line on what counted. It teaches the values, the red King's zero first.

/** The hands, in order; each has a red King or a face card to catch the eye. */
export const HANDS: string[][] = [
  ['K-H', '3-S', 'A-C', '5-D'],
  ['Q-S', '2-H', '7-C', 'K-D'],
  ['9-C', 'A-H', 'K-S', '4-D'],
  ['6-H', 'J-C', 'K-H', '2-S'],
  ['8-D', '3-C', 'A-S', '10-H'],
];

const card = (spec: string, id: number): Card => {
  const [rank, suit] = spec.split('-') as [Rank, Suit];
  return { id, rank, suit, deck: 0 };
};

/** The hand's total and three answers to choose from, the right one at a different place each time. */
export function question(index: number) {
  const hand = (HANDS[index % HANDS.length] ?? []).map(card);
  const sum = hand.reduce((t, c) => t + pointsOf(c as { rank: Rank; suit: Suit }), 0);
  const choices = [
    [sum, sum + 10, sum - 2],
    [sum + 3, sum, sum + 10],
    [sum + 10, sum - 1, sum],
  ][index % 3] as number[];
  const redKing = hand.some((c) => c.rank === 'K' && (c.suit === 'H' || c.suit === 'D'));
  return { hand, sum, choices, redKing };
}

export function Quiz({ text: t }: { text: LandingText }) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState({ good: 0, tries: 0 });
  const q = question(index);
  const answered = picked !== null;
  const verdict = !answered
    ? t.quizAsk
    : picked === q.sum
      ? q.redKing
        ? t.quizRightKing
        : t.quizRight
      : fill(q.redKing ? t.quizWrongKing : t.quizWrong, { n: q.sum });

  return (
    <>
      <ul className="quiz-hand" key={index}>
        {q.hand.map((c) => (
          <li key={c.id}>
            <CardView card={c} label={cardWords(t, c)} />
            {answered ? <span className="quiz-value">{pointsOf(c as { rank: Rank; suit: Suit })}</span> : null}
          </li>
        ))}
      </ul>
      <fieldset className="quiz-answers" aria-label={t.quizAria}>
        {q.choices.map((v) => (
          <button
            key={v}
            type="button"
            className={`quiz-answer${answered && v === q.sum ? ' good' : ''}${answered && v === picked && v !== q.sum ? ' bad' : ''}`}
            aria-pressed={picked === v}
            disabled={answered}
            onClick={() => {
              setPicked(v);
              setScore((s) => ({ good: s.good + (v === q.sum ? 1 : 0), tries: s.tries + 1 }));
              trackEvent('quiz-answered', { right: v === q.sum });
            }}
          >
            {v}
          </button>
        ))}
      </fieldset>
      <p className="quiz-verdict" aria-live="polite">
        {verdict}
      </p>
      <div className="quiz-foot">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setIndex(index + 1);
            setPicked(null);
          }}
        >
          {t.quizNext}
        </button>
        {score.tries ? <span className="quiz-score">{fill(t.quizScore, score)}</span> : null}
      </div>
    </>
  );
}
