# Project memory — decisions, reasons, traps

Long-term memory of this repo, read at the start of **every** agent session (imported by `CLAUDE.md`). It holds what the code and `git log` cannot tell you: the choices made and their reasons, what was tried and rejected, the traps that cost time, how the maintainer likes to work.

This file is the **always-loaded index**. The detail lives in `docs/memory/<topic>.md`, one file per area, loaded **on demand**: read the topic file(s) matching the area you are about to touch **before** acting (table at the bottom). Do not `@import` them into `CLAUDE.md`. Structural decisions are ADRs in `docs/DECISIONS.md`; memory links to them instead of restating them.

## How to maintain (mandatory — CLAUDE.md rule 2)

- **When**: at the end of every task, before its commit, in the same commit. Writing is the **default**; only skip if there is truly nothing a future agent could use, and say so explicitly in the final message.
- **What**: a design/product decision, a non-obvious technical choice, an explicit rejection ("the maintainer did not want X because Y"), a trap and its remedy, a working preference. Not implementation detail readable in the diff, not what `git log` already says.
- **Where**: the matching `docs/memory/<topic>.md`; a new file only when no topic fits (kebab-case name, add it to the table below). Cross-cutting rules, working style, decisions-at-a-glance and open items stay in this index.
- **How**: search first and **update** the existing entry rather than adding a near-duplicate; delete what became false. One entry = one short paragraph: *decision → why → how to apply*, dated `YYYY-MM-DD` on first write and on each revision. Say the same thing **once**.
- **Language**: **English**, dense, factual. No session narration. No test counts (they rot).
- Budget: keep this index under ~200 lines and each topic file under ~150; if one outgrows that, split it.

## Working with Steeve Pommier

- 2026-10-16 — **Answers in French, short, results first.** His brief: «je n'aime pas qu'on me détaille l'implémentation trop tôt. Montre-moi des résultats (une démo, un écran, des tests qui passent)». **How to apply**: end a milestone with something he can run or look at, and a few lines on what to try; keep the how in the commit bodies.
- 2026-10-16 — **He does not write code and tests by hand on his phone.** Every line is an agent's. Size work in commits and milestones, never in developer days; what costs is his time (device tests, decisions), not code volume.
- 2026-10-16 — **Ambiguous rule → ask, then parameterise.** His words: «N'invente pas de règle silencieusement. Mets la règle en paramètre et choisis la valeur par défaut décrite ici». At most five questions, grouped.
- 2026-10-16 — **One milestone at a time, each playable or testable** before the next (`docs/SPEC.md` §8).
- 2026-10-16 — He likes Versus's look and asked for it to be reused here (ADR-0007).

## Direction in five lines

- A faithful "at home" Tamalou, pleasant on a phone in portrait; desktop and tablet must stay good.
- The game master configures **every** rule before the game; the engine reads a versioned `RuleSet` and hard-codes nothing, so variants come later without touching it.
- One pure engine everywhere: in the browser for solo and pass-and-play, on an authoritative server for LAN and online, where clients send intentions and receive only their filtered view.
- Online rooms are ephemeral: no account, no persisted data, gone after 2 h idle or at the end of the game.
- Later, out of scope for now: advanced variants, the owner's own card designs. Floated by the owner's friends (2026-11-27, «un délire», no decision): ranking, servers, a leaderboard — a real multiplayer game; a live view of the rooms in progress on the admin page would come with it.
- 2026-11-27 — **Beyond the friends' table** (the owner, after his friends played): ranking/Elo, public matchmaking, international, gamification (tutorial, a solo path, something viral), marketing, store apps as a bonus only (he holds the PWA enough and Apple's 99 €/yr not worth it). Listed and weighed in `docs/IDEAS.md`, nothing decided; each topic gets its own session from its section. **How to apply**: favour what works with no population first (daily challenge from the seeded engine, solo path), since an empty queue kills a small game; a public ranking needs a durable player identity, which reopens ADR-0024 (only a random, renewable device number), ADR-0025 (no account) and C18 (nothing to back up) — say so and write an ADR before building it.

## Decisions at a glance (details in `docs/DECISIONS.md` and the topic files)

- The repository stays **public** (owner, 2026-10-17), although the brief said private "pour l'instant": Registry blocks stay public-only (`Project:`, ticked boxes, `Log:`), and nothing private goes into a pull request or a commit.
- Commits follow the common spec's C3 (English imperative title, no `feat:` prefix), not Conventional Commits — ADR-0001.
- pnpm monorepo, packages ship TS sources, one typecheck, Biome + Vitest — ADR-0002, `architecture.md`.
- Front: React 19 + Vite + Motion — ADR-0003.
- Servers: a Node `ws` server for LAN (Docker on the homelab) AND a Cloudflare Worker + Durable Objects for online, both thin adapters over the pure `packages/room` — ADR-0004, `architecture.md`.
- Quick discard window: open from a card landing on the discard until the next player draws (3 s minimum since 2026-10-25, counted from when the screen has put the card down; a draw held only while someone else may claim); off by default in pass-and-play; never on the card the deal turns over unless the game master says so (2026-11-21); an opponent's card may be claimed by default, the claimer then giving one of theirs, chosen after the match, while the table waits (2026-11-21) — ADR-0005, ADR-0021, ADR-0022, `rules.md`.
- Defaults for the brief's unspecified rule points — ADR-0006, `rules.md`; since 2026-11-26 (the owner) a tied Tamalou is made and an empty hand calls Tamalou, both fields — ADR-0027.
- Visual identity reused from Versus; card faces behind a theme — ADR-0007, `design.md`.
- The engine has no clock: the quick-discard window is state, its minimum duration and the turn timer are the host's; a claim carries `expectTop` so a late claim is cancelled without penalty — ADR-0008, `rules.md`.
- Views are checked against events: a face in a view must have been revealed to that player by an event they received — `architecture.md`.
- The host (bot timing, the window's minimum, round flow, turn timer) is `packages/room`'s `Table` with an injected clock; the browser runs it for solo — ADR-0009, `architecture.md`.
- The web UI offers only `legalActions(view)`; quick discard is an armed mode; lines about "you" (log, end-of-round panel) have `_you` keys, never «Toi» in a `{name}` slot — `web.md`.
- Builds of `main` go to GitHub Pages (solo and pass-and-play only: no API there) — ADR-0010 — and, once configured, to Cloudflare with the rooms — ADR-0014.
- The game master edits every RuleSet leaf on one screen (a test fails if a leaf has none); rules travel as a preset + diff, by `#rules=` link or a JSON file — ADR-0011, `rules.md`, `web.md`.
- The rules screen (2026-11-24, the owner's picks H and I on a canvas): preset pills on top, one illustrated tile per section that opens in place on a phone, beside the column of tiles on a wide screen; card values and powers set on the cards — `web.md`, "The game master's screen".
- Pass-and-play: a cover between players, the spectator table while bots play, quick discard off by default as a mode layer under the game master's changes, claims made for a named player — ADR-0012, `web.md`.
- Rooms: one protocol and a pure `Room` (game master, tokens, away seats played by stand-ins, spectators, 2 h expiry) behind both servers — ADR-0013; online is one Worker with one in-memory Durable Object per room — ADR-0014.
- Polish: synthesised sounds, vibrations, slot flashes and a Tamalou splash from events; language switch remembered on the device — ADR-0015, `web.md`.
- The installed game follows Versus's PWA: a TypeScript worker bundled as `sw.js` with the precache list and a content version written in after the build, a new version that waits for «Recharger» / «Plus tard» on the home screen, the manifest (id, screenshots, icon shortcuts) and `_headers` written from `build/site.ts` — ADR-0020, `web.md`.
- The root is a static home page (FR `/`, EN `/en/`) written at build time, the game lives under `play/` (the owner's pick, 2026-10-17; `jouer/` forwards); on it, the visitor plays a guided first round against a bot, then a hand-value quiz (the owner's pick among three directions); cards from the card theme — ADR-0017, `site.md`.
- A legal notice (`/mentions-legales/`, `/en/legal/`) and Versus's anonymous Umami measurement, ported as is; the notice lists every event, a test holds the code to it — ADR-0018, `site.md`.
- Security headers from one list (`build/security.ts`, C16): written into the build's `_headers` for Cloudflare, read back by the LAN server, the CSP Report-Only with every inline script named by hash; Zod runs jitless so the policy sees no `new Function` — `site.md`, `architecture.md`.
- Nothing the table says sits over a card (2026-11-21, the owner's picks on a canvas): one band between the others and the piles (my turn, a power, what another says, else the journal), an icon by the speaker's name, and a power written in the prompt too — `web.md`, "The band".
- Anonymous usage statistics (no name, 13 months, one Durable Object; since 2026-11-24 the minute and a random per-game number; since 2026-11-27 a random number per device, renewed every 13 months, switched off in the settings, to see who comes back) and `/admin/` for the owner alone, signed in through his Sésame (OIDC, role `admin`): the period, a day, a game — ADR-0024, `architecture.md`.
- A profile on the device (2026-11-24, the owner's picks on the canvas): a name and an avatar (8 colours × 12 icons) shown on the seats and the lobby, sent to a room with the name, given by place to whoever has none; the games finished kept on the phone too («Mes parties», saved to and restored from a file), no account — ADR-0025, `web.md`.
- The player's cards (2026-11-24, the owner's ask): back colour, pattern, a 0–2 character mark and an effect (an oil-slick «Irisé» or a holographic foil, still until the pointer or the phone's tilt moves them; no sweep), a device setting read by the card theme — `design.md`, "The player's cards".
- A pause held by the host's `Table` (every clock stops, an opaque curtain), anyone on this device and automatic when the page hides, only the game master in a room (2026-11-21) — ADR-0023, `web.md`.
- The journal (2026-11-24): the game master's rule `assist.log` — the whole game, the last lap of the table (default) or none; Débutant gives it all; a panel pushing the table aside on a computer, a sheet over the hand on a phone; and `assist.discardStory`, the discard laid out from an icon beside it (off, on in Débutant) — ADR-0026, `web.md`, "The journal".
- The table's top bar (2026-11-24, the owner's pick A on a canvas): the way out, the round, the journal and «⋯» holding pause, sound, vibrations, display, rules and leaving — `web.md`, "The top bar".
- Nine languages (2026-11-27, the owner): fr, en, es, it, pt (Brazil), de, ja, zh-Hans, zh-Hant; French the source; the game opens in the phone's language; strict sync (a French change updates every language in the same PR, a lock fails `pnpm check` on a stale key); no native reviewer, so the `/translate` skill's back-translation review and a «Signaler une traduction» link — ADR-0028, `docs/plans/languages.md` (steps L0–L4).
- Readability: a spotlight on whose turn it is, always; confirming each move is the game master's choice (`assist.confirmMoves`, off by default) — ADR-0016, `web.md`.
- The table's look, chosen by the owner on the 2026-10-17 canvas: one-line action bar (A), rules as cards to leaf through (B), cards flying on soft springs for every move with the others' moves told in bubbles, drag and drop with soft physics (D) and quick discard by dragging onto the discard (C) — `web.md`.
- The launch screen (2026-10-22, the owner's pick on a canvas): the last game and "Rejouer" first, one tile per mode opening a panel with the table to set, the device's settings behind a button; the cards are dealt on the game's own table at every round, and a wide screen seats the others round an oval (2026-10-24) — `web.md`, "The launch screen".
- Watching the others (2026-10-25, the owner's picks on a canvas): their moves played by a hand rebuilt from the events, a named cursor with a mouse and a fingertip on touch screens; the bots' pace and the cards' speed are device settings, the pace never touching a quick-discard reaction — `web.md`, "Watching the others".
- The drawn card (2026-10-25, the owner's picks on a canvas): another player's in front of them, raised on their side; mine held above my hand by default or large on the table, a device setting; the others' card backs face them; a card they take from the discard leans their way, face still readable (2026-11-24); the deal starts on an empty discard; a touch on the discard or my drawn card lifts it and sends nothing until it is put down (2026-11-13) — `web.md`, "The drawn card".
- Hand layouts (2026-10-22, the owner's picks on a canvas): six of them, the row by default, a device setting and not a rule, opponents' arcs and fans turned to face me — `web.md`, "Hand layouts".
- Versions: one SemVer version in the root `package.json`, `CHANGELOG.md` as source, tags and GitHub Releases made by `release.yml` on `main`, a release is its own PR on the owner's word; 0.16.0 Piquet today (2026-11-24), after 0.15.0 Oudler, 0.14.0 Nain jaune, 0.13.0 Manille, 0.12.0 Levée, 0.11.0 Kems, 0.10.0 Joker, 0.9.0 Impasse (the game moved to `play/`) and 0.8.0 Honneur, the first published one, with M1–M7 backfilled as 0.1.0–0.7.0 — ADR-0019, `CLAUDE.md` rule 4.
- Dependabot follows the portfolio's C20 (2026-10-21): monthly with a cooldown, one minor-and-patch PR, the gate's tools (Biome, TypeScript) in a `tooling` PR of their own since 2026-11-05, families (react, vite, vitest) moved together on a major, Node's major (image, `@types/node`) held to `.nvmrc` (26 since 2026-10-21, corepack installed from npm) and raised by hand — `architecture.md`, "Dependabot".
- Bots see their view and their events only, pick among `legalActions`, and leave timing to the host (`profile.delays`); three levels tuned in `PROFILES`, hard beats easy 100 % and medium 73 % (2026-10-16) — `bots.md`.
- The portfolio standard, `COMMON-PROJECT-SPEC.md` in `second-brain`, adopted 2026-10-19 (the repo was born on it; the pass closed what C14–C19 still asked): the LAN image on an exact Node tag with Dependabot (C14, C15), security headers and a Report-Only CSP from one list (C16), a social card per language and robots.txt, a sitemap and llms.txt (C17), the data statement in `CLAUDE.md` (C18), the canonical `/memorize`; what was left to the owner and what is n/a — `architecture.md`, "The portfolio standard applied".

## Open items

- 2026-10-16 — GitHub Pages must be switched on once by the owner (Settings → Pages → Source: GitHub Actions) for `deploy.yml` to publish https://costardrouge.github.io/tamalou/.
- 2026-10-16 — Owner to judge M4 on his phone: change a rule, play, see it applied; share a rules link.
- 2026-10-16 — Owner to judge M5 at the table with 2 or 3 people: the cover between players, the table view while bots play.
- 2026-10-16 — Owner to judge on his phone (M3's acceptance): the easy bot never wins against a thinking bot (`bots.md`), card sizes with five opponents, the quick-discard armed mode.

- 2026-10-16 — Confirm with the owner: penalty cards the empty pile cannot give are skipped (`rules.md`, provisional default).

- 2026-10-16 — `bin/registry-setup.sh tamalou` must be run by the owner (from his machine) so `registry.yml`'s `send` job can report; until then it says so and stays green.
- 2026-10-16 — Online play ships as soon as the owner sets the repository variable `CLOUDFLARE_ACCOUNT_ID` and the secret `CLOUDFLARE_API_TOKEN` (the Versus ones work) and picks a domain in the dashboard (suggestion: tamalou.steevepommier.com); until then `deploy.yml` skips the Worker (ADR-0014).

- 2026-10-16 — Owner to check once `deploy.yml` has pushed the image: make the `tamalou` package public on GitHub (Packages → Package settings), or `docker login ghcr.io` on the Optiplex; otherwise compose builds from the repository. Then judge M7 on the home network: `docker compose up -d`, scan the QR code in the logs, play.

- 2026-10-16 — Owner to judge M8 on his phone: sounds and vibrations (Android vibrates, iPhone does not), "Installer le jeu", a solo game in airplane mode, the English switch.
- 2026-10-19 — Owner to judge the PWA on his phone once deployed: the install dialog's screenshots (Chrome, Android), a long press on the icon (Partie solo, À plusieurs), the «Une nouvelle version est prête» bar after the next deploy, the home-screen words in Safari; on iPhone, that the installed app shows the status bar in the page's colour.

- 2026-10-19 — **The content security policy is Report-Only** (`build/security.ts`): clean on the LAN server's build in headless Chromium (home pages, legal notices, the game, a room); once a tour of the deployed site (Cloudflare, the tracker on) shows a clean console, rename the header to `Content-Security-Policy` there and in `test/security.test.ts`, nothing else — `site.md`.
- 2026-10-17 — Once deployed, check the first views and events in Umami (Tamalou's site on insight.steevepommier.com): both hosts, clean paths, no room code — ADR-0018.
- 2026-11-24 — Owner to judge the profile on his phone: «Bonjour …» on the home screen, «Mon profil» (name, colour, icon), his avatar on his seat and in a room's tiles as the others see it; «Mes parties» after a few games, «Sauvegarder» then «Restaurer» on another phone.
- 2026-11-24 — Owner to judge «Tes cartes» on his phone (Réglages, or «Affichage» at the table): each colour, pattern and effect, an emoji as the mark; whether Holo follows the tilt on his phone (Android yes, iPhone only drifts) and stays smooth with ten players.
- 2026-10-22 — Owner to judge the new launch screen on his phone: "Rejouer", a tile's panel (add and remove bots, names, rules), the deal, the settings behind the button; pass-and-play with five or six players.
- 2026-10-24 — Owner to judge the deal on the table (phone and desktop) and the wide table on his computer: four and six players, the journal at the side.
- 2026-10-25 — Owner to judge the pacing on a phone: the 3 s quick-discard window from the card landing (Règles → Défausse rapide to tune it), the bots waiting for each move to finish, «À toi !» after the others, the bubbles and the journal line as the hand plays, a quick discard during one's own power (drag or bolt), the deal ending clean.
- 2026-10-25 — Owner to judge the drawn card on a phone and a computer: a bot's card in front of it, raised its way; "En main" and "En grand" in "Affichage", dragging the card onto one's own cards and the discard; the turned backs; the deal ending on the discard.
- 2026-10-25 — Owner to judge the others' hands on his phone (the fingertip) and his computer (the cursor), and the three paces and card speeds in "Affichage".
- 2026-10-22 — Owner to judge the quick discard by hand on his phone: during a bot's turn, the glowing discard, the lifted cards, a drag onto it; the small bolt as the second way.
- 2026-11-24 — Owner to judge on his phone a bot taking the discard: the card in front of it leaning its way, face shaded but readable, on a seat in front and at the side of the wide table.
- 2026-10-22 — Owner to judge the six hand layouts on his phone (the row by default, a fan with penalty cards, the opponents' turned arcs, the carousel's slide, a drag onto the laid-down hand).
- 2026-10-23 — Owner to open a wrong address once deployed (e.g. `/projects/`): the styled 404 page with a 404 status, «Jouer» and «Accueil» working — `site.md`, "The 404 page".
- 2026-11-24 — Owner to judge the journal on his phone and his computer (the sheet and its handle, the panel pushing the table, «Dernier tour»), and the discard laid out in a Débutant game (the icon beside the discard, a touch on a card for its story).
- 2026-11-24 — Owner to judge the top bar on his phone: «⋯» and its items (the sound and the vibrations switched in place), the journal beside it, the way out.
- 2026-11-24 — Owner to judge the new rules screen on his phone and his computer: the tiles, a tile opening in place, card points and powers set on the cards, the cards seen at the start.
- 2026-10-17 — Owner to try the home page's first round and quiz on his phone (the round must be winnable by a first-timer; the table is zoomed to 66 % there).
- 2026-11-27 — **Languages, next step L0** (`docs/plans/languages.md` § 6): the foundations, shipped with French and English only, in its own session; then L1 (the skill + Spanish), L2 (it, pt, de), L3 (ja, both Chinese).
- 2026-10-17 — The backfilled releases v0.1.0 to v0.6.0 wait on `second-brain`'s "Backfill releases" workflow, run once by the owner with his token for every repository; v0.7.0–v0.9.0 are published — ADR-0019, `architecture.md`.


## Topic files

| file | read when |
| --- | --- |
| `docs/memory/architecture.md` | touching the package layout, the engine/room/transport split, the servers |
| `docs/memory/rules.md` | touching the `RuleSet`, a rule's default, presets, the engine's resolution order |
| `docs/memory/design.md` | touching the UI's look, tokens, fonts, the card theme |
| `docs/memory/bots.md` | touching a bot level, bot memory, the match driver, `pnpm bots` |
| `docs/memory/site.md` | touching the home page, the site's pages and addresses, SEO, the service worker's scope |
| `docs/memory/web.md` | touching `apps/web`: screens, connection, interaction, dictionaries, build |
