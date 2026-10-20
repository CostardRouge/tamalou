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

`packages/room` holds `Table` (ADR-0009): the engine state, the bots and every clocked rule, with an injected `Scheduler` (tests drive a `FakeClock` in `packages/room/test/table.test.ts`). Bots plan a move with their level's delay and keep it while it stays legal (re-deciding on every event would reset the delay forever); a human draw that comes before `quickDiscard.minWindowMs` is accepted and played when the window has run (`submit` returns `deferred`); `endRound` waits for the window, `nextRound` for every human's `continue`; a timed-out human (`pace.turnTimerSeconds`) gets their turn played by a medium stand-in bot that watched the whole game. Seats, tokens, kick and expiry live around it in `Room` (below), not in the adapters. For a shared screen it also answers `humanToAct()` (the first human still peeking, or the current player when human; null while bots play or between rounds) and keeps `publicEvents()`; `handoff.ts` holds the pass-and-play state machine (ADR-0012) and `SPECTATOR`, a seat id that is no player, for which `viewFor` shows only public cards.

## Rooms (2026-10-16)

`Room` (ADR-0013) is the whole server logic; adapters only call `connect`, `receive(conn, parseClientMessage(raw))`, `disconnect` and implement `send`/`drop`. Traps: `drop` may call back `disconnect` synchronously (the room deletes the connection before ending it, so this is a no-op); a connection's game log is sent incrementally (`from` = index of the first new event), reset to 0 on every new connection, start and replay, so a client rebuilds its log as `log.slice(0, from).concat(events)`. Away humans are played by the `Table`'s stand-ins (`setAway`), which exist for every human now, not only with a turn timer. `createGame` cannot actually fail on valid rules with ≤ 6 players (8 cards × 6 + 2 < 52), but `start` still catches and refuses `rules`.

## The Node server (2026-10-16)

`apps/server` (LAN, ADR-0004): `node:http` + `ws`, no framework; `RoomHost` maps codes to `Room`s and sockets to connection ids, `startServer(port, host, opts)` adds the API, a ping/pong heartbeat (phones vanish without closing sockets) and the web app's static files (hashed `assets/` immutable, everything else `no-cache`, extension-less unknown paths fall back to `index.html`, paths that decode outside the root or fail to decode get 403). `main.ts` runs with Node's type stripping, no build. Its tests open real sockets on port 0; the quick-discard race is set up by searching a seed where both humans hold the first discard's rank and fixing the room's `random` to it. **Trap**: `WHATWG URL` folds `%2e%2e` into `..` before the server sees it, so a traversal test must use `%2f`. **Trap (2026-10-20)**: `wss.handleUpgrade(req, socket, head, cb)` emits no `'connection'` event by itself, so the heartbeat's `wss.on('connection')` (which marks a socket alive and listens for its pongs) never saw any socket, and the first beat ended every one: each LAN player got « Connexion perdue » every 25 s, reconnecting a second later. The upgrade callback now emits `'connection'`. The suite runs with `heartbeatSeconds: 3600`, which is how it went unseen; `server.test.ts` "LAN server heartbeat" runs a 50 ms beat both ways (a live socket stays across beats, a socket with `autoPong: false` is ended). **How to apply**: a test that turns a timer off for speed needs one test with the timer on.

## The Worker (2026-10-16)

`apps/worker` (ADR-0014) has its own `tsconfig.json` (Workers types) and is in `pnpm typecheck`; `pnpm worker:dev` runs it on workerd at :8787 with the built app, `pnpm worker:check` bundles it (CI), `pnpm worker:deploy` ships it. Verified 2026-10-16 with the three-phone Playwright scenario against `wrangler dev` (create, link, code, reload, disconnection), same result as the Node server. **Traps**: the Durable Object's methods are RPC (`stub.open(code)`, `stub.phase()`), the WebSocket goes through `stub.fetch(request)`; a WebSocket route for an impossible code answers with its own socket that says `closed: notFound`, so the client hears the same thing as from a closed room. pnpm 12 fails a frozen install on ignored build scripts (`ERR_PNPM_IGNORED_BUILDS`): every package with an install script must be listed under `allowBuilds` in `pnpm-workspace.yaml`.

## Docker (2026-10-16)

Two stages (`Dockerfile`): a full install builds the web app; the runtime installs only `--prod --filter "@tamalou/server..."` and runs `node apps/server/src/main.ts` (type stripping, so the workspace packages must stay outside `node_modules`: no `pnpm deploy`). 255 MB on `node:24-alpine`. `docker-compose.yml` uses the host's network so the logs print the machine's real LAN addresses (Docker Desktop: ports + `PUBLIC_URL`). CI builds and health-checks the image; `deploy.yml` pushes amd64 to `ghcr.io/costardrouge/tamalou` with the plain docker CLI (no third-party actions, no QEMU). **Trap (cloud sessions)**: `dockerd` is installed but not running — start it in the background; a build there needs the agent proxy's CA (`/root/.ccr/ca-bundle.crt`) copied into the context and `NODE_EXTRA_CA_CERTS` plus the proxy variables in a test-only copy of the Dockerfile, with `--network host`; never commit that copy.

## pnpm 12 (2026-10-16)

The owner moved `packageManager` to pnpm 12.14.0 (his corepack fetched the latest and broke on 10.28.0) and pushed an npm `package-lock.json` by accident; the npm file is removed and gitignored (pnpm only). Two pnpm 12 traps: a lockfile written by pnpm 10 fails `--frozen-lockfile` ("Cannot update packageManagerDependencies"), fixed by one `pnpm install` that records pnpm itself in the lockfile; and pnpm 12 refuses any package published less than a day ago (`ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`). **How to apply**: when it trips on a fresh transitive release, `pnpm update -r --depth Infinity <package>` re-resolves that one package to an older version; never relax the policy without asking.

## Releases: the backfilled tags (2026-10-17)

`gh release create` with the job's `GITHUB_TOKEN` gets `HTTP 403: Resource not accessible by integration` for a tag on a commit whose `.github/workflows/` differs from `main`'s (the token lacks the `workflows` permission). `release.yml` now skips such a backfill with a warning and ships the rest (`CLAUDE.md` rule 4); the refused ones go through `second-brain`'s "Backfill releases" workflow, run by the owner. State on 2026-10-17: v0.7.0, v0.8.0 and v0.9.0 are published; v0.1.0–v0.6.0 wait on that workflow. **Trap**: v0.8.0's tag sits on `5f97b9d` (the merge that taught the workflow to skip, which tagged the then-current release on its own commit), not on the `2b824cc` its later `<!-- commit: -->` marker names; the workflow never moves an existing tag, so leave both as they are.
