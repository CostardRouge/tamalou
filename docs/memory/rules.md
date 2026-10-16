# Rules and the RuleSet

The rules of record are `docs/SPEC.md` §2 (defaults) and §3 (what must be configurable). This file keeps what the brief did not settle and how the engine resolves it.

## Defaults chosen for unspecified points (2026-10-16)

Each is a `RuleSet` field; the value below is the default (ADR-0006). The owner was told and did not object; any of them can be flipped without touching the engine.

- **Caller's tie counts as a failure**: the brief says the caller is penalised unless they have *strictly* the lowest total.
- **A power resolves before any quick discard** on the card that triggered it: the power's owner acts first, then the quick-discard window opens on that card.
- **A penalty card opens a new slot** in the grid (the hand grows beyond 2×2), face down, unseen by its owner.
- **The Tamalou caller may still quick-discard** during the last round, and their locked cards stay untouchable by others' powers (`lockCallerCards`, default on).
- **Game-end ties**: tied players share the win (no tie-break round).
- **`minTurnsBeforeCall` = 0**: the brief asks for the parameter without a value.
- **Penalty cards the pile cannot give are skipped** (`penaltySkipped` event), after the discard has been reshuffled in. Provisional: unasked edge case, to confirm with the owner.
- **A drawn card goes into a filled slot only**: a slot emptied by a quick discard cannot take a swap, and taking the discard is refused (`mustSwap`) to a player with no card left.

## Quick discard window (2026-10-16)

Owner's pick (ADR-0005): the window opens when a card lands face up on the discard and closes when the **next player draws**, with a minimum of 2 s (`quickDiscard.minWindowMs`) so a fast bot or player cannot shut it instantly. In pass-and-play it is **off by default** (one screen cannot show a hidden race fairly) and can be turned on. Concurrent claims: the authority accepts the first one it processes; the others see a changed top card and are cancelled without penalty (brief §2).

## RuleSet shape (2026-10-16)

`packages/shared/src/rules.ts`: Zod 4, version 1. Nested objects use `.prefault({})`, not `.default()`: a Zod 4 default short-circuits parsing, a prefault is parsed, so `parseRules({})` is "Classique" and any partial input (a preset, an imported JSON, one rank's value) gets every other default. Per-rank values and powers are objects with one defaulted field per rank for the same reason (a `z.record` over an enum is exhaustive in Zod 4). A preset is a partial input; `rulesFromPreset(id, overrides)` deep-merges (arrays replaced) and parses. **How to apply**: a new rule is a field with a default here, a test in `packages/shared/test/rules.test.ts`, and an ADR if it settles something the brief left open.

## How the engine resolves a turn (2026-10-16)

- Steps within `play`: `draw` → `place` → (`power` → `reveal`) → (`callDecision` in endOfTurn timing) → next player. Phases: `initialPeek` → `play` → `roundEnding` → `roundOver` → … → `gameOver`.
- **The engine has no clock.** The quick-discard window is a boolean in the state (`window`): opened when a card lands face up (or the power on it resolves), closed by the next draw. `quickDiscard.minWindowMs` and `pace.turnTimerSeconds` are the HOST's to enforce (hold a draw back, have a bot play on timeout). `roundEnding` keeps the window open after the last turn until the host sends `endRound`; the host also sends `nextRound`. `hostAction(state)` says which one is owed.
- **A claim names the top card it was aimed at** (`expectTop`). A different top → `staleTop`, refused with no penalty: that is how "the first claim the server validates wins" holds without the engine knowing about concurrency.
- A failed claim shows the claimed card to everyone (it went to the discard and came back), so it becomes public knowledge.
