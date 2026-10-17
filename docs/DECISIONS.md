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

## ADR-0009 — One host for every table: `packages/room`'s `Table`, clock injected (2026-10-16)

- **Context**: solo needs, in the browser, what a server will need later: bots playing at a human pace, the quick-discard window's minimum, scoring a round once its window has run, dealing the next one, the turn timer (ADR-0008 keeps all of it out of the engine).
- **Decision**: a pure `Table` in `packages/room` owns the state, the bots and these rules, with an injected `Scheduler`. The browser wraps it in `LocalConnection` with the real clock; the LAN and online servers will wrap the same class with sockets, adding seats, tokens and expiry around it. A human's early draw is deferred to the window's end rather than refused.
- **Rejected**: host logic in the React app (it would be rewritten for each server, against the rule that business logic lives in `packages/`); refusing an early draw (the player would have to guess when to tap again).

## ADR-0010 — Publish `main` on GitHub Pages until the online server exists (2026-10-16)

- **Context**: M3's acceptance is a full game on the owner's phone; solo needs no server.
- **Decision**: `deploy.yml` builds `apps/web` on every push to `main` and publishes it on GitHub Pages (the repository is public, so Pages is free). The build uses relative paths, so it works under `/tamalou/`. Pages must be switched on once in the repository settings.
- **Rejected**: Cloudflare now (its account and domain are M6 decisions, not worth taking for a static page); a preview per pull request (no host for it without extra services).

## ADR-0011 — Rules travel as a preset plus a diff: link fragment and JSON file (2026-10-16)

- **Context**: the brief asks for rules exported and imported as JSON and shared by link, and the online lobby (M6) will hand a table's rules to every player.
- **Decision**: a table's rules are a `RulesChoice` — a preset id and only the fields that differ from it. A link carries it in the fragment, `#rules=<base64url of {"p": preset, "o": overrides}>`: short, never sent to a server, read once and removed from the address. The JSON file is the full rules plus `"format": "tamalou-rules"`, so a person reading it sees every value; importing accepts any partial object. Everything coming in goes through the schema; a link that does not validate is ignored.
- **Rejected**: the full rules in the link (several times longer, and it would freeze presets' values into links); a query string (sent to the server, logged); a compression library for the link (the diff of a typical table is a few dozen bytes).

## ADR-0012 — Pass-and-play: a cover between players, the table in between, mode defaults as a layer (2026-10-16)

- **Context**: several players share one device (brief §5.2): nothing private may be on screen while it changes hands, bots can sit at the same table, and the quick discard is off by default there (ADR-0005) yet must stay a rule the game master can switch on.
- **Decision**: the room's `Table` says which human the game waits for; a `Handoff` state machine (in `packages/room`) hides the previous player's view at once and shows the next one's only after they tap "C'est moi" on a cover that draws nothing of the game. While no human has a move (bots playing, a round ending), the screen shows the table as a spectator — a seat id that is no player — with every hand face down and only the public log. Mode defaults (`MODE_DEFAULTS.pass = quick discard off`) are a layer between the preset and the game master's changes (`rulesOf(choice, base)`), so the editor shows the quick discard as off and switchable, and the changes stay measured from what the mode starts with. When it is on, a claim is made for a named player, from their own legal moves, with their cards face down; only their own cards.
- **Rejected**: a dedicated claim phase after every turn (one more screen per turn on a passed phone); writing the mode default into the game master's changes (switching mode back would have to guess which change was the mode's); showing the last player's view during bots' turns (beginner mode and peeks would leak to the table).

## ADR-0013 — Rooms: one protocol, a pure `Room`, tokens and stand-ins (2026-10-16)

- **Context**: online and LAN play (brief §5.3–5.4) need the same lobby, reconnection, bot takeover and expiry, served by two different adapters (ADR-0004).
- **Decision**: `packages/shared/src/protocol.ts` defines every message (JSON over one WebSocket per client), parsed with Zod on the server; an action arrives without `by`, which the room fills with the sender's seat. `packages/room`'s `Room` holds the lobby around a `Table` with an injected clock and `send`/`drop` callbacks: the first player in is the game master (rules, bots, removing a player, start, replay); a token handed out on arrival takes a seat back; a dropped connection shows "disconnected" at once and turns "away" after 30 s, when the seat's stand-in bot plays its moves (never its quick discards) and the next round stops waiting for it; the game master's role passes to someone present. Anyone arriving during a game watches it (public view and log). A room closes after 2 h without a message, or once a finished game has nobody connected. Codes are 5 characters from an alphabet without I, O, 0, 1.
- **Rejected**: a seat taken over by a bot for good on disconnection (a phone locking for a minute would lose its game); refusing latecomers (watching is free and is the brief's spectator option); per-message acknowledgements (a refused message gets a `refused`; everything else shows in the next lobby or game update).

## ADR-0014 — Online host: one Worker, one Durable Object per room, in memory (2026-10-16)

- **Context**: online rooms (brief §5.3) need an authority reachable from anywhere; the owner chose Cloudflare Durable Objects (ADR-0004) and already runs Versus there.
- **Decision**: `apps/worker` is one Worker serving the built web app (assets, single-page fallback) and the same API as the LAN server under `/api` (`run_worker_first`). A room code names a Durable Object (`idFromName`); `POST /api/rooms` draws codes until one opens, behind a per-IP rate limit. The object keeps a `packages/room` `Room` in memory, accepts WebSockets the plain way (not hibernated, so timers and bots run) and persists nothing. CI bundles the Worker (`wrangler deploy --dry-run`) on every run; `deploy.yml` deploys it from `main` once the repository has `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`, as Versus does. pnpm keeps `esbuild` and `workerd` install scripts off (`allowBuilds: false`): wrangler runs without them.
- **Consequence**: an object with no open socket is evicted after a short idle time, and its room with it; a room where every phone dropped for a few minutes is gone. Acceptable while games are played with phones in hand; the remedy, if it bites, is to snapshot the room into the object's storage with an alarm for the two-hour expiry (the brief allows it).
- **Rejected**: hibernatable WebSockets (the room's timers and bots need a live object); a Worker without Durable Objects (no single authority per room); a separate Pages project for the app (two deploys for one site).

## ADR-0015 — Polish without assets: synthesised sounds, a generated service worker (2026-10-16)

- **Context**: M8 asks for sounds, vibrations, richer animations, a language switch and an installable PWA, while the game must stay light and work offline for solo and pass-and-play.
- **Decision**: sounds are a few WebAudio notes per cue (no file to download, cache or license), quiet, chosen from the events that arrive while a screen is open (one cue per batch, by priority); vibrations only for what concerns the player. Both are switches remembered on the device, with a mute button on the table. A move flashes the slots it touched, and a call raises a "Tamalou !" splash; `prefers-reduced-motion` turns the flash into a plain outline. The language is a home-screen switch remembered on the device, French by default (`?lang=` still forces one). A Vite plugin writes `sw.js` after the build with every file to keep and a content hash as version: the page network-first with a 4 s fallback to the cache, built files cache-first, `/api/` never touched. A new version is announced on the home screen only, so a reload never cuts a game.
- **Rejected**: a PWA plugin (`vite-plugin-pwa`/Workbox: a dependency tree for some forty lines); audio files; reloading on update by itself (a local game lives only in the page).

## ADR-0016 — Semantic versions, a changelog and releases made by CI (2026-10-17)

- **Context**: the owner wants every project versioned, with codenames, so he knows which build he holds and so his site (steevepommier.com) can show each project's version, changelog and past states. Until now every push to `main` deployed an anonymous build. Rule in the common spec: C13 (`second-brain`'s `COMMON-PROJECT-SPEC.md`), pasted here as rule 4 of `CLAUDE.md`.
- **Decision**: one version for the repository, in the root `package.json` (the workspace packages stay `0.0.0`, they are never published); `CHANGELOG.md` in the Keep a Changelog shape is the source of truth, and `.github/workflows/release.yml` (with `.github/release.mjs`, identical in every repo) checks it on every pull request and, on `main`, creates the tag and GitHub Release of every section that has none. A release is a pull request of its own, on the owner's word; deploys still follow every push to `main`. Tamalou starts at **0.8.0** (pre-1.0: the owner has not judged the milestones on his phone yet), with M1 to M7 backfilled as 0.1.0 to 0.7.0 on their milestone commits. Codenames are French card words in alphabetical order (As … Honneur). The home screen shows the version.
- **Rejected**: a version per workspace package (nothing is published, it would only multiply numbers); Conventional Commits with an automatic bump (C3 already chose plain titles, ADR-0001, and the owner decides when to release); tagging by hand (a tag nobody checks against the changelog drifts); 0.0.x or 1.0.0 to start (the milestones map one to one onto minors, and 1.0 is the owner's call once he has played it).
