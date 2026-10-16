# Rules and the RuleSet

The rules of record are `docs/SPEC.md` §2 (defaults) and §3 (what must be configurable). This file keeps what the brief did not settle and how the engine resolves it.

## Defaults chosen for unspecified points (2026-10-16)

Each is a `RuleSet` field; the value below is the default (ADR-0006). The owner was told and did not object; any of them can be flipped without touching the engine.

- **Caller's tie counts as a failure**: the brief says the caller is penalised unless they have *strictly* the lowest total.
- **A power resolves before any quick discard** on the card that triggered it: the power's owner acts first, then the quick-discard window opens on that card.
- **A penalty card opens a new slot** in the grid (the hand grows beyond 2×2), face down, unseen by its owner.
- **The Tamalou caller may still quick-discard** during the last round, and their locked cards stay untouchable by others' powers (`lockCallerCards`, default on).
- **Game-end ties**: tied players share the win (no tie-break round).

## Quick discard window (2026-10-16)

Owner's pick (ADR-0005): the window opens when a card lands face up on the discard and closes when the **next player draws**, with a minimum of 2 s (`quickDiscard.minWindowMs`) so a fast bot or player cannot shut it instantly. In pass-and-play it is **off by default** (one screen cannot show a hidden race fairly) and can be turned on. Concurrent claims: the authority accepts the first one it processes; the others see a changed top card and are cancelled without penalty (brief §2).
