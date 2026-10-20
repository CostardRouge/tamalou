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

## The Node server (2026-10-16, rev. 2026-10-19)

`apps/server` (LAN, ADR-0004): `node:http` + `ws`, no framework; `RoomHost` maps codes to `Room`s and sockets to connection ids, `startServer(port, host, opts)` adds the API, a ping/pong heartbeat (phones vanish without closing sockets) and the web app's static files (hashed `assets/` immutable, everything else `no-cache`, extension-less unknown paths fall back to `index.html`, paths that decode outside the root or fail to decode get 403). Its response headers are the build's: `src/headers.ts` reads `dist/_headers` once at startup (`site.md`, "Security headers") and every answer carries its `/*` block; the file is never served. `main.ts` runs with Node's type stripping, no build. Its tests open real sockets on port 0; the quick-discard race is set up by searching a seed where both humans hold the first discard's rank and fixing the room's `random` to it. **Trap**: `WHATWG URL` folds `%2e%2e` into `..` before the server sees it, so a traversal test must use `%2f`.

## The Worker (2026-10-16)

`apps/worker` (ADR-0014) has its own `tsconfig.json` (Workers types) and is in `pnpm typecheck`; `pnpm worker:dev` runs it on workerd at :8787 with the built app, `pnpm worker:check` bundles it (CI), `pnpm worker:deploy` ships it. Verified 2026-10-16 with the three-phone Playwright scenario against `wrangler dev` (create, link, code, reload, disconnection), same result as the Node server. **Traps**: the Durable Object's methods are RPC (`stub.open(code)`, `stub.phase()`), the WebSocket goes through `stub.fetch(request)`; a WebSocket route for an impossible code answers with its own socket that says `closed: notFound`, so the client hears the same thing as from a closed room. pnpm 12 fails a frozen install on ignored build scripts (`ERR_PNPM_IGNORED_BUILDS`): every package with an install script must be listed under `allowBuilds` in `pnpm-workspace.yaml`.

## Docker (2026-10-16, rev. 2026-10-19)

Two stages (`Dockerfile`): a full install builds the web app; the runtime installs only `--prod --filter "@tamalou/server..."` and runs `node apps/server/src/main.ts` (type stripping, so the workspace packages must stay outside `node_modules`: no `pnpm deploy`). 255 MB on `node:24.22.0-alpine`. **The base image is pinned to an exact tag** (COMMON-PROJECT-SPEC C14, since 2026-10-19): a moving `24-alpine` ships whatever runtime the registry holds that day, untested here; `.github/dependabot.yml` raises the tag weekly (its `docker` block, beside `npm` for pnpm's lockfile and `github-actions`), and the CI gate's image job checks the bump. **How to apply**: never float the tag back; when a Dependabot bump fails the health check, the Node release is the suspect (spotify-poller's 24.19.0 crashed better-sqlite3). `docker-compose.yml` uses the host's network so the logs print the machine's real LAN addresses (Docker Desktop: ports + `PUBLIC_URL`). CI builds and health-checks the image; `deploy.yml` pushes amd64 to `ghcr.io/costardrouge/tamalou` with the plain docker CLI (no third-party actions, no QEMU). **Trap (cloud sessions)**: `dockerd` is installed but not running — start it in the background; Docker Hub answers 429 to the container's anonymous pulls, so a test-only copy of the Dockerfile reads the same tag from `mirror.gcr.io/library/node:…`, takes the agent proxy's CA through `docker build --build-context ca=/root/.ccr` (`COPY --from=ca ca-bundle.crt`, `NODE_EXTRA_CA_CERTS`), the proxy variables as `--build-arg`s and `--network host`; never commit that copy. Verified that way on 2026-10-19: build, start, `/api/health` in 2 s.

## The portfolio standard applied (2026-10-19)

`COMMON-PROJECT-SPEC.md` (second-brain) C14–C19, measured against this repo on 2026-10-18 and closed on 2026-10-19 (the scaffold, rules 1–4, the trailer rule, `AGENTS.md` as a symlink, Biome in the gate, the icon set, the legal notice, EN + FR and the versions were there from the first commit). **Now in force**: `.nvmrc` 24 and `engines` ≥ 22.18, the Docker base image on an exact tag raised by `.github/dependabot.yml` (npm, actions, docker — "Docker" above); `ci.yml` as the PR gate (`biome ci`, typecheck, coverage, build, the Worker's dry bundle, a 300-game simulation, the image health-checked); security headers from `apps/web/build/security.ts` with a Report-Only CSP (`site.md`, "Security headers"); the 1200×630 social cards, `robots.txt`, the sitemap and `llms.txt` (`site.md`); the C18 statement in `CLAUDE.md` (no data held); `/memorize` byte for byte the canonical text (the ADR duty it used to repeat stays in rule 2 of `CLAUDE.md`, which it follows). **Left to the owner** (C19): GitHub's description, homepage and topics on the repository. **Deliberately not done**: JSON-LD (`site.md`); axe, which C17 asks only where an e2e suite exists (token contrast tests and `prefers-reduced-motion` are the a11y checks here). **Traps met**: the Docker Hub 429 and `mirror.gcr.io` (above); `npm i --no-save` inside a pnpm workspace (`design.md`); Zod's `new Function` under a CSP (`site.md`).

## pnpm 12 (2026-10-16)

The owner moved `packageManager` to pnpm 12.14.0 (his corepack fetched the latest and broke on 10.28.0) and pushed an npm `package-lock.json` by accident; the npm file is removed and gitignored (pnpm only). Two pnpm 12 traps: a lockfile written by pnpm 10 fails `--frozen-lockfile` ("Cannot update packageManagerDependencies"), fixed by one `pnpm install` that records pnpm itself in the lockfile; and pnpm 12 refuses any package published less than a day ago (`ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`). **How to apply**: when it trips on a fresh transitive release, `pnpm update -r --depth Infinity <package>` re-resolves that one package to an older version; never relax the policy without asking.

## Releases: the backfilled tags (2026-10-17)

`gh release create` with the job's `GITHUB_TOKEN` gets `HTTP 403: Resource not accessible by integration` for a tag on a commit whose `.github/workflows/` differs from `main`'s (the token lacks the `workflows` permission). `release.yml` now skips such a backfill with a warning and ships the rest (`CLAUDE.md` rule 4); the refused ones go through `second-brain`'s "Backfill releases" workflow, run by the owner. State on 2026-10-17: v0.7.0, v0.8.0 and v0.9.0 are published; v0.1.0–v0.6.0 wait on that workflow. **Trap**: v0.8.0's tag sits on `5f97b9d` (the merge that taught the workflow to skip, which tagged the then-current release on its own commit), not on the `2b824cc` its later `<!-- commit: -->` marker names; the workflow never moves an existing tag, so leave both as they are.
