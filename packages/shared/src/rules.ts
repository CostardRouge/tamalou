import { z } from 'zod';
import { RANKS, type Rank, SUITS } from './cards.ts';

// The RuleSet: every rule the engine applies, typed, versioned and validated. The engine never hard-codes a rule;
// it reads this object. A preset is a partial RuleSet merged with the defaults (docs/SPEC.md §3).
//
// Nested objects use `.prefault({})` rather than `.default(...)`: in Zod 4 a default short-circuits parsing, while a
// prefault is parsed, so a partial object still gets every inner default. That is what makes `parseRules({})` the
// "Classique" rules and a preset nothing more than the fields it changes.

export const RULESET_VERSION = 1;

export const POWERS = ['none', 'peekOwn', 'peekOther', 'blindSwap', 'peekThenSwap'] as const;
export type Power = (typeof POWERS)[number];

const rank = z.enum(RANKS);
const suit = z.enum(SUITS);

const DEFAULT_VALUES: Record<Rank, number> = {
  A: 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 10,
  Q: 10,
  K: 10,
  JOKER: -1,
};

const DEFAULT_POWERS: Partial<Record<Rank, Power>> = {
  '7': 'peekOwn',
  '8': 'peekOwn',
  '9': 'peekOther',
  '10': 'peekOther',
  J: 'blindSwap',
  Q: 'peekThenSwap',
};

// One field per rank, each with its own default, so a preset can change a single rank's value or power.
const valueValue = z.number().int().min(-50).max(50);
const valuesByRank = z
  .object(
    Object.fromEntries(RANKS.map((r) => [r, valueValue.default(DEFAULT_VALUES[r])])) as Record<
      Rank,
      z.ZodDefault<typeof valueValue>
    >,
  )
  .prefault({});
const powerValue = z.enum(POWERS);
const powersByRank = z
  .object(
    Object.fromEntries(RANKS.map((r) => [r, powerValue.default(DEFAULT_POWERS[r] ?? 'none')])) as Record<
      Rank,
      z.ZodDefault<typeof powerValue>
    >,
  )
  .prefault({});

const valueOverride = z.object({
  rank,
  /** Empty means every suit. */
  suits: z.array(suit).default([]),
  value: valueValue,
});

export const RuleSetSchema = z
  .object({
    version: z.literal(RULESET_VERSION).default(RULESET_VERSION),

    deck: z
      .object({
        /** Number of 52-card decks shuffled together. The brief suggests 2 above four players, as an option. */
        count: z.number().int().min(1).max(2).default(1),
        jokers: z.boolean().default(false),
        jokersPerDeck: z.number().int().min(0).max(4).default(2),
      })
      .prefault({}),

    values: z
      .object({
        byRank: valuesByRank,
        /** Checked in order before byRank: the first match wins. Default: red kings are worth 0. */
        overrides: z.array(valueOverride).default([{ rank: 'K', suits: ['H', 'D'], value: 0 }]),
      })
      .prefault({}),

    hand: z
      .object({
        size: z.number().int().min(1).max(8).default(4),
        /** Grid width for display; slots are numbered row by row, so a 2×2 grid has 0 1 on top and 2 3 below. */
        columns: z.number().int().min(1).max(4).default(2),
        initialPeek: z
          .object({
            /** fixed: the engine shows `slots`; choose: each player picks `count` slots. */
            mode: z.enum(['fixed', 'choose']).default('fixed'),
            count: z.number().int().min(0).max(8).default(2),
            slots: z.array(z.number().int().min(0).max(7)).default([2, 3]),
          })
          .prefault({}),
      })
      .prefault({}),

    powers: z
      .object({
        byRank: powersByRank,
        /** drawPile: only a card drawn from the pile and discarded directly; anyPile: also one taken from the discard. */
        activation: z.enum(['drawPile', 'anyPile']).default('drawPile'),
      })
      .prefault({}),

    discardPickup: z
      .object({
        /** A card taken from the discard must be swapped in (cannot be put straight back). */
        mustSwap: z.boolean().default(true),
      })
      .prefault({}),

    quickDiscard: z
      .object({
        enabled: z.boolean().default(true),
        /** Cards drawn face down, unseen, for a claim that does not match. Each opens a new slot (ADR-0006). */
        penaltyCards: z.number().int().min(0).max(4).default(1),
        /** Claim an opponent's card; on a match the claimer gives that opponent one of their own cards. */
        allowOpponentCards: z.boolean().default(false),
        /**
         * The window opens when a card lands face up on the discard and closes when the next player draws (ADR-0005).
         * The engine has no clock: the host (LocalConnection, the room) holds a draw back until this long after the
         * window opened.
         */
        minWindowMs: z.number().int().min(0).max(30_000).default(3000),
      })
      .prefault({}),

    tamalou: z
      .object({
        /** startOfTurn: the call replaces the turn; endOfTurn: offered after the player's own turn. */
        timing: z.enum(['startOfTurn', 'endOfTurn']).default('startOfTurn'),
        /** The caller's cards cannot be touched by the others' powers or claims during the last round. */
        lockCallerCards: z.boolean().default(true),
        /** The caller fails unless strictly lowest, so a tie is a failure (ADR-0006). */
        failPenalty: z
          .object({
            mode: z.enum(['add', 'double']).default('add'),
            amount: z.number().int().min(0).max(100).default(10),
          })
          .prefault({}),
        /** zero: a caller who wins scores 0 for the round. */
        winBonus: z.enum(['none', 'zero']).default('none'),
        /** Own turns the player must have played in the round before calling. The brief names no value: 0. */
        minTurnsBeforeCall: z.number().int().min(0).max(20).default(0),
      })
      .prefault({}),

    round: z
      .object({
        /** A player left with no card ends the round at once. */
        emptyHandEndsRound: z.boolean().default(false),
      })
      .prefault({}),

    gameEnd: z
      .object({
        /** threshold: eliminated at `threshold` or above; rounds: a fixed number of rounds, lowest total wins. */
        mode: z.enum(['threshold', 'rounds']).default('threshold'),
        threshold: z.number().int().min(10).max(1000).default(100),
        /** lastStanding: play until one player is left; firstElimination: stop at the first, lowest total wins. */
        thresholdEnd: z.enum(['lastStanding', 'firstElimination']).default('lastStanding'),
        rounds: z.number().int().min(1).max(50).default(5),
      })
      .prefault({}),

    pace: z
      .object({
        /** 0 = no turn timer. When it runs out, the host has a bot play the turn. */
        turnTimerSeconds: z.number().int().min(0).max(600).default(0),
      })
      .prefault({}),

    assist: z
      .object({
        /** Beginner mode: a player's view shows the cards they have seen and that have not moved since. */
        showKnownCards: z.boolean().default(false),
        /**
         * Each consequential touch (swapping, looking at or discarding a card, a quick discard) and a Tamalou call is
         * staged and confirmed before it is sent. The table's UI applies it; the engine does not read it (ADR-0016).
         */
        confirmMoves: z.boolean().default(false),
      })
      .prefault({}),
  })
  .superRefine((r, ctx) => {
    const { size, initialPeek } = r.hand;
    if (initialPeek.count > size) {
      ctx.addIssue({ code: 'custom', path: ['hand', 'initialPeek', 'count'], message: 'more than the hand size' });
    }
    if (initialPeek.mode === 'fixed') {
      if (initialPeek.slots.some((s) => s >= size)) {
        ctx.addIssue({ code: 'custom', path: ['hand', 'initialPeek', 'slots'], message: 'slot outside the hand' });
      }
      if (new Set(initialPeek.slots).size !== initialPeek.slots.length) {
        ctx.addIssue({ code: 'custom', path: ['hand', 'initialPeek', 'slots'], message: 'duplicate slot' });
      }
    }
  });

export type RuleSet = z.infer<typeof RuleSetSchema>;
/** What a preset or an imported JSON carries: any subset, at any depth. */
export type RuleSetInput = z.input<typeof RuleSetSchema>;

/** Validates a (partial) RuleSet and fills every missing field with its default. Throws a ZodError when invalid. */
export function parseRules(input: unknown = {}): RuleSet {
  return RuleSetSchema.parse(input);
}

export function safeParseRules(input: unknown) {
  return RuleSetSchema.safeParse(input);
}

export const DEFAULT_RULES: RuleSet = parseRules({});
