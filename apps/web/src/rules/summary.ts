import { DEFAULT_RULES, type Power, RANKS, type Rank, type RuleSet, STANDARD_RANKS, type Suit } from '@tamalou/shared';
import { type Key, plural, rankName, t } from '../i18n/index.ts';

// The active rules in plain French, short enough to read on a phone (docs/SPEC.md §3): shown under the game master's
// screen and to every player during the game. One line per idea; a line that differs from "Classique" is flagged so
// a table can see at a glance what is unusual tonight.

export interface SummaryLine {
  text: string;
  /** Differs from the Classique rules. */
  changed: boolean;
}

export interface SummarySection {
  title: Key;
  lines: SummaryLine[];
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const SUIT_SYMBOL: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
const FACE: Partial<Record<Rank, number>> = Object.fromEntries(
  STANDARD_RANKS.filter((r) => /^\d+$/.test(r)).map((r) => [r, Number(r)]),
);

function values(r: RuleSet): string {
  const v = r.values.byRank;
  const standard =
    v.A === 1 &&
    STANDARD_RANKS.every((rank) => FACE[rank] === undefined || v[rank] === FACE[rank]) &&
    v.J === 10 &&
    v.Q === 10 &&
    v.K === 10;
  const joker = r.deck.jokers ? ` · ${t('rank_JOKER')}\u00a0${v.JOKER}` : '';
  if (standard) return `${t('sum_valuesStandard')}${joker}`;
  const ranks = RANKS.filter((rank) => rank !== 'JOKER' || r.deck.jokers);
  return ranks.map((rank) => `${rankName({ rank })}\u00a0${v[rank]}`).join(' · ');
}

/** The ranks that carry each power, in rank order (jokers only when the deck has them). */
export function powerGroups(r: RuleSet): [Power, Rank[]][] {
  const groups = new Map<Power, Rank[]>();
  for (const rank of RANKS) {
    const p = r.powers.byRank[rank];
    if (p === 'none' || (rank === 'JOKER' && !r.deck.jokers)) continue;
    groups.set(p, [...(groups.get(p) ?? []), rank]);
  }
  return [...groups];
}

export const powerLine = (power: Power, ranks: Rank[]) =>
  t('sum_power', { ranks: ranks.map((rank) => rankName({ rank })).join(', '), power: t(`power_${power}` as Key) });

function powers(r: RuleSet): string[] {
  const groups = powerGroups(r);
  if (groups.length === 0) return [t('sum_noPowers')];
  return groups.map(([power, ranks]) => powerLine(power, ranks));
}

function peek(r: RuleSet): string {
  const { mode, count, slots } = r.hand.initialPeek;
  if (mode === 'choose') return plural('sum_peekChoose', count);
  if (slots.length === 0) return t('sum_peekNone');
  const cols = r.hand.columns;
  const rows = Math.ceil(r.hand.size / cols);
  const bottom = Array.from({ length: Math.min(cols, r.hand.size) }, (_, i) => (rows - 1) * cols + i).filter(
    (s) => s < r.hand.size,
  );
  if (same([...slots].sort(), bottom)) return plural('sum_peekBottom', slots.length);
  return t('sum_peekSlots', { slots: slots.map((s) => s + 1).join(', ') });
}

export function summarize(r: RuleSet): SummarySection[] {
  const d = DEFAULT_RULES;
  const line = (text: string, changed: boolean): SummaryLine => ({ text, changed });

  const deck = line(
    r.deck.jokers
      ? plural('sum_deckJokers', r.deck.count, { jokers: r.deck.jokersPerDeck * r.deck.count })
      : plural('sum_deck', r.deck.count),
    !same(r.deck, d.deck),
  );
  const specials = r.values.overrides.map((o) =>
    line(
      t('sum_override', {
        rank: rankName({ rank: o.rank }),
        suits: o.suits.length === 0 ? t('sum_allSuits') : o.suits.map((s) => SUIT_SYMBOL[s]).join(' '),
        value: o.value,
      }),
      !same(r.values.overrides, d.values.overrides),
    ),
  );

  const q = r.quickDiscard;
  const quick = q.enabled
    ? [
        line(plural('sum_quickPenalty', q.penaltyCards), q.penaltyCards !== d.quickDiscard.penaltyCards),
        line(
          t(q.allowOpponentCards ? 'sum_quickOpponents' : 'sum_quickOwn'),
          q.allowOpponentCards !== d.quickDiscard.allowOpponentCards,
        ),
        line(t('sum_quickWindow', { s: q.minWindowMs / 1000 }), q.minWindowMs !== d.quickDiscard.minWindowMs),
      ]
    : [line(t('sum_quickOff'), true)];

  const tm = r.tamalou;
  const fail = tm.failPenalty.mode === 'double' ? t('sum_failDouble') : plural('sum_failAdd', tm.failPenalty.amount);
  const g = r.gameEnd;
  const end =
    g.mode === 'rounds'
      ? [line(plural('sum_endRounds', g.rounds), true)]
      : [
          line(t('sum_endThreshold', { n: g.threshold }), g.threshold !== d.gameEnd.threshold),
          line(
            t(g.thresholdEnd === 'lastStanding' ? 'sum_lastStanding' : 'sum_firstElimination'),
            g.thresholdEnd !== d.gameEnd.thresholdEnd,
          ),
        ];

  return [
    { title: 'sec_deck', lines: [deck] },
    { title: 'sec_values', lines: [line(values(r), !same(r.values.byRank, d.values.byRank)), ...specials] },
    {
      title: 'sec_hand',
      lines: [
        line(
          t('sum_hand', { n: r.hand.size, cols: r.hand.columns }),
          r.hand.size !== d.hand.size || r.hand.columns !== d.hand.columns,
        ),
        line(peek(r), !same(r.hand.initialPeek, d.hand.initialPeek)),
      ],
    },
    {
      title: 'sec_powers',
      lines: [
        ...powers(r).map((text) => line(text, !same(r.powers.byRank, d.powers.byRank))),
        line(
          t(r.powers.activation === 'drawPile' ? 'sum_activationPile' : 'sum_activationAny'),
          r.powers.activation !== d.powers.activation,
        ),
        line(
          t(r.discardPickup.mustSwap ? 'sum_mustSwap' : 'sum_mayDiscard'),
          r.discardPickup.mustSwap !== d.discardPickup.mustSwap,
        ),
      ],
    },
    { title: 'sec_quick', lines: quick },
    {
      title: 'sec_tamalou',
      lines: [
        line(t(tm.timing === 'startOfTurn' ? 'sum_callStart' : 'sum_callEnd'), tm.timing !== d.tamalou.timing),
        ...(tm.minTurnsBeforeCall > 0 ? [line(plural('sum_minTurns', tm.minTurnsBeforeCall), true)] : []),
        line(t(tm.lockCallerCards ? 'sum_locked' : 'sum_unlocked'), tm.lockCallerCards !== d.tamalou.lockCallerCards),
        line(fail, !same(tm.failPenalty, d.tamalou.failPenalty)),
        ...(tm.winBonus === 'zero' ? [line(t('sum_bonusZero'), true)] : []),
        ...(r.round.emptyHandEndsRound ? [line(t('sum_emptyHand'), true)] : []),
      ],
    },
    { title: 'sec_end', lines: end },
    {
      title: 'sec_pace',
      lines: [
        line(
          r.pace.turnTimerSeconds > 0 ? t('sum_timer', { s: r.pace.turnTimerSeconds }) : t('sum_noTimer'),
          r.pace.turnTimerSeconds !== d.pace.turnTimerSeconds,
        ),
        ...(r.assist.showKnownCards ? [line(t('sum_beginner'), true)] : []),
        ...(r.assist.confirmMoves ? [line(t('sum_confirmMoves'), true)] : []),
      ],
    },
  ];
}
