# Bots

`packages/bots`: three levels over the engine (docs/SPEC.md §5.1). Read before touching a bot's play, its memory, the match driver or `pnpm bots`.

## What a bot may know (2026-10-16)

A bot is handed its `viewFor()` and the events its player receives (`isVisibleTo`), nothing else; it picks among `legalActions(view)`. `BotMemory` rebuilds what a careful human could note from those events: cards seen per slot, followed through swaps, quick discards (and the card handed over with `give`), failed claims (the card is shown to all), the public discard pile (reshuffles return it to the unknown). The estimate of any unseen card is the mean value of the cards whose place it cannot name (`unknownMean`). **How to apply**: a bot that needs a fact the events do not carry is a bug in the bot, never a reason to pass it the state; a new event that moves or shows a card needs a case in `BotMemory.observeOne`.

## The three levels (2026-10-16)

`PROFILES` in `bot.ts` holds every knob. **easy** plays uniformly among legal turn moves, calls with 12 % chance when it may, never claims a quick discard (the brief: random but legal). **medium** remembers 85 % of what it sees and forgets 8 % per own turn, swaps on a 2-point gain, calls at an estimated ≤ 6 with at most one unseen card. **hard** remembers everything, swaps on a 1-point gain, picks power targets by threat (lowest estimated opponent), discards a drawn card that pairs one of its own to quick-discard the twin, and calls at ≤ 8 (with 1.5 points of risk per unseen card) only 2 points under the lowest opponent estimate. Every bot calls once it has played 12 turns in a round (`FORCE_CALL_AFTER`), so a round of cautious bots cannot run forever.

**Measured 2026-10-16** (`pnpm bots --games 200`, classic rules, 2 seats): hard beats easy 100 %, medium beats easy 100 %, hard beats medium 73 %; at three seats hard 71 %, medium 29 %, easy 0 %. The test `ranks the levels` keeps hard > 0.9 vs easy and > 0.55 vs medium. Easy never wins against a thinking bot: true to the brief, possibly too weak to be fun — the owner's call once he plays it (M3).

## Timing belongs to the host (2026-10-16)

The engine has no clock (ADR-0008) and neither do bots: `profile.delays` gives the host a turn delay and a quick-discard reaction delay per level (hard reacts in 0.5–1.1 s, medium 0.9–1.8 s, easy 1.5–3 s, though easy never claims). `playMatch` is the clockless stand-in: after each action every bot observes its events, then quick-discard claims go first in a seeded random order (a later claim on the same top card would be refused as stale), then the current player moves.
