# Architecture

## Package layout (2026-10-16)

Planned layout, filled milestone by milestone (`docs/SPEC.md` §8):

| package | role | may import |
| --- | --- | --- |
| `packages/shared` | types, Zod schemas (`RuleSet`, presets, actions, views, protocol messages) | `zod` only |
| `packages/engine` | the reducer, seeded RNG, `viewFor`, replay | `shared` |
| `packages/bots` | three bot levels over a `PlayerView`, and the bot-vs-bot simulation CLI | `shared`, `engine` (for legal moves on a view) |
| `packages/room` | seats, tokens, readiness, kick, turn timers, bot takeover, expiry: pure, clock injected | `shared`, `engine`, `bots` |
| `apps/web` | React UI; `GameConnection` with `LocalConnection` and `RemoteConnection` | everything in `packages/` |
| `apps/server` | Node `ws` adapter of `room` for LAN; serves the built web app; Docker | `room` |
| `apps/worker` | Cloudflare Worker + one Durable Object per room, adapter of `room` for online | `room` |

**Why**: the brief (§4) makes the engine pure and authoritative everywhere. Putting the room logic (everything a server decides beyond the game) in its own pure package is what makes two server adapters cheap — the owner picked Durable Objects for online on 2026-10-16, and LAN needs a process on his machine anyway (ADR-0004). **How to apply**: an adapter only translates sockets, timers and storage into `room` calls; a rule that ends up in an adapter is a bug.

## Packages ship sources (2026-10-16)

Each package's `package.json` `exports` points at `src/index.ts`; Vite, Vitest, wrangler (esbuild) and Node ≥ 22.18 (type stripping) all read TypeScript directly, so there is no build step and no `dist/` between packages. One root `tsconfig.json` typechecks everything. **Trap to remember**: Node's type stripping refuses files *under* `node_modules`; pnpm's workspace links resolve to the real path outside it, which is why this works — do not switch to `node-linker=hoisted` copies. Node's stripping also refuses TS-only syntax (enums, parameter properties, namespaces): keep packages to erasable syntax (`erasableSyntaxOnly` is the intent).

## Engine API and invariants (2026-10-16)

`@tamalou/engine`: `createGame({seed, players, rules})`, `apply(state, action, rules)` → `{ok, state, events} | {ok:false, error}`, `viewFor(state, me, rules)`, `legalActions(view, rules)`, `hostAction(state)`, `replay(record)`, `playRandomGame(opts)`. **Decisions**: the state is plain JSON (Durable Object storage, deep equality in tests); `apply` works on a `structuredClone` and never mutates its input; the seeded mulberry32 state lives in `state.rng`; an event with `to` is private to that player, every other is public (`isVisibleTo`) — a transport sends each player the public events and their own. `legalActions` takes a VIEW, not the state, so bots and UIs choose from exactly what a human sees.

**The leak test is independent of `viewFor`** (`packages/engine/test/properties.test.ts`): it records every card id each player was shown by the events they would receive, and fails if a view ever shows a face outside that set. Mutation-checked on 2026-10-16 (showing opponents' cards fails it at step 0). **How to apply**: a new event that shows a card must be listed in the test's `shown()`, or the test will (rightly) fail; a new view field carrying a face goes in `faces()`.

**Perf trap**: `expect()` per card per step made the property test ten times slower and time out at 5 s; the loop uses plain checks and throws. The engine clones the whole state, `cards` table included, on each action (~0.5 ms with six players); fine for play, the first thing to trim if bot simulations get slow.

## The table host (2026-10-16)

`packages/room` holds `Table` (ADR-0009): the engine state, the bots and every clocked rule, with an injected `Scheduler` (tests drive a `FakeClock` in `packages/room/test/table.test.ts`). Bots plan a move with their level's delay and keep it while it stays legal (re-deciding on every event would reset the delay forever); a human draw that comes before `quickDiscard.minWindowMs` is accepted and played when the window has run (`submit` returns `deferred`); `endRound` waits for the window, `nextRound` for every human's `continue`; a timed-out human (`pace.turnTimerSeconds`) gets their turn played by a medium stand-in bot that watched the whole game. M6/M7 add seats, tokens, kick and expiry around it, not inside the adapters.

## pnpm 12 (2026-10-16)

The owner moved `packageManager` to pnpm 12.14.0 (his corepack fetched the latest and broke on 10.28.0) and pushed an npm `package-lock.json` by accident; the npm file is removed and gitignored (pnpm only). Two pnpm 12 traps: a lockfile written by pnpm 10 fails `--frozen-lockfile` ("Cannot update packageManagerDependencies"), fixed by one `pnpm install` that records pnpm itself in the lockfile; and pnpm 12 refuses any package published less than a day ago (`ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`). **How to apply**: when it trips on a fresh transitive release, `pnpm update -r --depth Infinity <package>` re-resolves that one package to an older version; never relax the policy without asking.
