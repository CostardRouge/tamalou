# Decisions

Short ADRs: context, decision, rejected alternatives. Numbered in order, never renumbered; a reversed decision gets a new ADR that says which one it supersedes. `docs/SPEC.md` marks every amendment with its ADR number.

## ADR-0001 — Commit format: the common spec's C3, not Conventional Commits (2026-10-16)

- **Context**: the brief asked for Conventional Commits (`feat:`, `fix:`); the portfolio's common spec (C3) forbids any `feat:`-style prefix and asks for an English imperative title ≤ 72 characters plus a body carrying the why.
- **Decision**: C3, the owner's pick. Every repo of the portfolio reads the same way in `git log`.
- **Rejected**: Conventional Commits as a Tamalou-only exception — a second convention for one repo, with no changelog tooling that would need it.

## ADR-0002 — pnpm monorepo, packages ship TypeScript sources (2026-10-16)

- **Context**: one engine must run in the browser, in Node and in a Cloudflare Worker; the brief asked for workspaces.
- **Decision**: pnpm workspaces (`packages/*`, `apps/*`); each package exports `src/index.ts`; one root `tsconfig.json` typechecks the tree (TypeScript 7, strict, `noUncheckedIndexedAccess`); Biome 2 for lint and format with Versus's settings; Vitest 5 + fast-check; CI on every pull request.
- **Rejected**: built packages with project references (a `dist/` per package to keep fresh, for no consumer that cannot read TS); npm workspaces (the brief asked for pnpm, and its strict linking catches undeclared dependencies); Turborepo/Nx (no build graph to cache yet).

## ADR-0003 — Front: React 19 + Vite + Motion (2026-10-16)

- **Context**: Versus has no UI framework on purpose (its D24/D75: a light web app). Tamalou has far more UI state (a table, a turn machine, overlays, a lobby) and its brief insists on careful card animations: deal, flip, swap, discard.
- **Decision**: React 19, Vite, Motion (formerly Framer Motion) for layout and shared-element animations. The owner's pick.
- **Rejected**: no framework like Versus (the animations and the state would be hand-written, which is where regressions live); Preact + CSS animations (lighter, but without Motion's layout animations that make a card fly from a grid to the discard).

## ADR-0004 — Servers: Durable Objects online, Node on the LAN, one pure room package (2026-10-16)

- **Context**: online rooms must be ephemeral, reachable by link, and authoritative; LAN play must work with no internet, which needs a process on a machine of the local network (a browser cannot host a WebSocket server).
- **Decision**: online play runs on a Cloudflare Worker with one Durable Object per room (the owner's pick: always up, like Versus's backend, no homelab dependency). LAN play runs a Node `ws` server (`pnpm serve:lan`, Docker image for the Optiplex) that also serves the web app. Both are thin adapters over `packages/room`, a pure module holding everything a server decides beyond the game — seats, tokens, readiness, kick, turn timers, bot takeover, expiry — with the clock injected, so it is unit-tested once and behaves the same on both.
- **Rejected**: one Node server for both (it would put online play on the homelab's uptime); Colyseus (its automatic state synchronisation fights `viewFor`: each client must receive its own filtered view, never a shared state with fields hidden); PartyKit (a layer over Durable Objects that adds a dependency for what a Durable Object already does).

## ADR-0005 — Quick discard window (2026-10-16)

- **Context**: the brief allows a quick discard "at any time" but needs a closing point for an authoritative server and for bots, and flagged pass-and-play as hard on one screen.
- **Decision**: the window opens when a card lands face up on the discard and closes when the next player draws, never before `quickDiscard.minWindowMs` (default 2000 ms). Off by default in pass-and-play, can be turned on. First claim processed by the authority wins; others are cancelled without penalty. The owner's pick.
- **Rejected**: a fixed N-second window after every discard (slows every turn even when nobody holds a match); a dedicated claim phase after each turn in pass-and-play (one more screen per turn on a passed phone).

## ADR-0006 — Defaults for points the brief leaves open (2026-10-16)

- **Context**: the brief's rules leave a few interactions unspecified; its own instruction is to parameterise and pick the described default.
- **Decision**, each a `RuleSet` field with this default:
  - the caller is penalised unless *strictly* lowest, so a tie is a failure;
  - a power resolves before any quick discard on the card that triggered it;
  - a penalty card opens a new face-down slot, unseen by its owner;
  - the Tamalou caller may still quick-discard; their locked cards stay out of others' powers;
  - tied players at game end share the win;
  - `minTurnsBeforeCall` is 0 (the brief names the parameter, not a value);
  - penalty cards an empty pile cannot give (after reshuffling the discard in) are skipped — provisional, to confirm.
- **Rejected**: inventing tie-break rounds or a hand-size cap the brief never mentions.

## ADR-0007 — Visual identity from Versus; card faces behind a theme (2026-10-16)

- **Context**: the owner likes Versus's charter and asked for it here; he designs his own decks in another project.
- **Decision**: Versus's tokens (cobalt `--a`, coral `--b`, light and dark), fonts (Bricolage Grotesque, Figtree, JetBrains Mono) and contrast checks are copied into `apps/web`. Card faces and backs are drawn by a card theme component; nothing else knows how a card looks.
- **Rejected**: a shared design package between the two repos (the portfolio keeps repos independent, `COMMON-PROJECT-SPEC.md` §9).

## ADR-0008 — The engine has no clock; claims name their target top card (2026-10-16)

- **Context**: the engine must be a pure reducer, replayable from a seed and its actions, yet the brief has timed rules (turn timer, a quick-discard window "délai") and a race (simultaneous quick discards, first validated wins).
- **Decision**: time stays out of the engine. The window is a state flag (open from a card landing, or its power resolving, to the next draw; open after the last turn until the host's `endRound`). Its minimum length (`quickDiscard.minWindowMs`) and the turn timer are enforced by the host — `LocalConnection` in the browser, `packages/room` on a server — by holding a draw back and by having a bot play a timed-out turn. Host-only actions (`endRound`, `nextRound`) carry `by: 'host'`. A quick-discard claim carries `expectTop`, the discard's top card it was aimed at: the authority applies claims in arrival order, and a claim whose top has changed is refused (`staleTop`) with no penalty.
- **Rejected**: timestamps inside actions (a replay would depend on wall-clock data, and a client could forge them); a fixed-duration window counted in engine "ticks" (an action nobody plays just to move time).
