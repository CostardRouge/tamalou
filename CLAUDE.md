# Instructions for LLM agents (Claude Code, Codex, Cursor, etc.)

Agents read this file at the start of every session. These rules override the agent's default behaviour and apply for the whole session, not only the first turn. They are cut from `COMMON-PROJECT-SPEC.md` in the private `second-brain` repository (profile **app**).

## Context

- **Tamalou** — the French card game (a "Cabo"/"Golf" cousin: four face-down cards, peek, swap, powers, quick discard, call "Tamalou!" to end the round) as a playable, mobile-first web game. Four modes: solo against bots, pass-and-play on one device, LAN (a local server, no internet) and online (temporary rooms joined by code or link, no account). The full brief is `docs/SPEC.md`; every structural choice is an ADR in `docs/DECISIONS.md`.
- **Owner**: Steeve Pommier (GitHub `CostardRouge`). He writes in **French**: answer in French. He wants results (a demo, a screen, green tests), not implementation walkthroughs. He does not write code: every line here is written by an agent from his prompts; he decides, reviews and tests by hand.
- **Stack**: pnpm workspaces monorepo, TypeScript 7 strict (`noUncheckedIndexedAccess`), Biome 2 (lint + format), Vitest 5 (+ fast-check). Packages export their **TypeScript sources** (no build step between them); one `tsc --noEmit` checks the whole tree. `apps/web` is React 19 + Vite + Motion (ADR-0003), checked by its own `apps/web/tsconfig.json`; it runs solo games in the browser through `packages/room`'s `Table` (ADR-0009). Rooms run on a Node `ws` server for LAN (`apps/server`, Docker for the homelab) and on a Cloudflare Worker + Durable Objects online (`apps/worker`, its own `tsconfig.json`), both thin adapters over `packages/room`'s `Room` (ADR-0004, ADR-0013, ADR-0014).
- **Commands that exist today**: `pnpm install`, `pnpm lint`, `pnpm format`, `pnpm typecheck`, `pnpm test`, `pnpm coverage` (fails under 90 % lines/functions/statements, 80 % branches on `packages/*/src`), `pnpm simulate [--games N --players N --preset id --seed N]` (random legal games; exit 1 on a crash, a stall or a deadlock), `pnpm bots [--levels hard,easy --games N --preset id]` (bot-vs-bot win rates by level), `pnpm dev` (the web app on Vite's dev server, reachable from a phone on the same network), `pnpm build` (`apps/web/dist`), `pnpm serve:lan` (build + the LAN server on :8080, prints the address and a QR code), `pnpm worker:dev` / `worker:check` / `worker:deploy` (the online Worker on workerd at :8787, bundled dry, deployed), `docker compose up -d` (the LAN server's image), and **`pnpm check`** (lint + typecheck + tests + build), which is the gate. CI (`.github/workflows/ci.yml`) runs biome ci + typecheck + coverage + build + the Worker's dry bundle + a 300-game simulation, and builds and health-checks the Docker image, on every pull request and on `main`; `deploy.yml` publishes `main` on GitHub Pages (ADR-0010), pushes the image to ghcr.io, and deploys the Worker once Cloudflare is configured (ADR-0014). Icons: `npm i --no-save sharp && node apps/web/scripts/icons.mjs`, PNGs committed. Do not document a command here before it runs.
- **This repository is PUBLIC**, and stays so: the brief wanted it private, the owner chose public on 2026-10-17. So rule 3's public-repo restriction applies: a Registry block carries only `Project:`, ticked boxes and one `Log:` line — never a `Last point:` nor an open box. `registry.yml` reads the visibility itself, so nothing here needs changing if the repo goes private.
- Package manager: **pnpm** (version pinned by `packageManager`, enabled with `corepack enable`). `pnpm-lock.yaml` is the only lockfile.
- Several agent sessions may run **in parallel** on this repo. Git history must stay readable: **one commit = one task**.
- **Local sessions: never `git push`** — the developer tests locally and pushes himself. **Cloud / web sessions (ephemeral container): push the working branch and open a pull request**, it is the only way the code gets out. Never push to `main` either way. (The single exception was the root commit, `Add the MIT license`, pushed to `main` with the owner's approval so that a pull request had a base.)

## Rule 1 — Automatic commit at the end of every task (MANDATORY)

As soon as a task requested by the user is finished (feature, fix, refactor, content…), the agent MUST create a commit before handing back. No need to ask permission: it is the expected behaviour.

### Exact procedure

1. **Check the state**: `git status --porcelain` and `git diff --stat`.
2. **Select only the task's files**:
   - Stage file by file with `git add <path>` (never `git add -A`, `git add .` or `git commit -a`).
   - A modified file unrelated to the task (parallel session, tooling noise) stays **unstaged**. Do not touch it, stash it or reset it.
   - If one file holds changes from this task AND another, prefer `git add -p <file>` to stage only the relevant hunks. If inextricable, stage the whole file and say so in the commit body ("also contains …").
   - Never stage: `.env` and any secret file, `.idea/`, `.vscode/`, `dist/`, `node_modules/`, `coverage/`, `.wrangler/`, `*.tsbuildinfo`, `.DS_Store` — unless the task is explicitly about them. If one of these turns out to be *tracked*, say so: it must be untracked and gitignored, not carefully avoided at every commit.
   - Check with `git diff --cached --stat` before committing.
3. **Commit with a readable message** (format below). Always use a HEREDOC to keep title + body, and end it with the attribution trailer(s) your harness asks for (the spelling is K2 of the common spec, still open):

   ```bash
   git commit -m "$(cat <<'EOF'
   Imperative title, ≤ 72 characters, no trailing period

   Why this change, what it does concretely, non-obvious decisions.
   One line per idea. Mention the files/areas touched if useful.

   Co-Authored-By: …
   EOF
   )"
   ```

4. **Push only from a cloud session** (see Context). End the reply with a recap: short hash + commit title + the list of files that were modified but deliberately **left uncommitted**, if any.
5. If a git hook changes or refuses something: read the output, fix, recommit. Never `--no-verify`.

### Commit message format

- **Title**: English imperative, clear sentence, ≤ 72 chars, **no `feat:`-style prefix** (the owner chose the common spec's C3 over Conventional Commits on 2026-10-16, ADR-0001), no trailing period. Example: `Resolve a quick discard against the server's first claim`.
- **Blank line**, then a **body**, mandatory whenever the title is not enough: the *why*, the *how* in 2–6 lines, the trade-offs, what remains to do.
- A commit **never** mixes two tasks. If a session handles several distinct tasks, make several successive commits.
- No empty commit, no "WIP" commit, no commit for an unfinished task. If the task is interrupted, leave the work uncommitted and say so.

### When is a task "finished"?

- The requested code is written **and** `pnpm check` is green (exactly what CI gates). A change to what renders also gets looked at in a browser: Chromium is in the cloud container (`/opt/pw-browsers`), drive `pnpm build` + `vite preview` with Playwright at phone size, both themes.
- A plain question, an exploration or an explanation produces **no** commit (nothing to commit).

## Rule 2 — Project memory in `MEMORY.md` + `docs/memory/` (MANDATORY)

The repo carries its own long-term memory, read locally and in the cloud alike:

- **`MEMORY.md`** at the root — the **index**, imported below and therefore loaded every session: how to maintain the memory, how the maintainer works, direction and decisions at a glance, open items, and a table of topic files.
- **`docs/memory/<topic>.md`** — one file per area, loaded **on demand**. Not imported here on purpose: the split keeps the per-session prompt small.

Obligations:

- **Read `MEMORY.md`, then the topic file(s) for the area you are about to touch, before acting** — to understand previous choices and not re-propose what was rejected. The table at the bottom of `MEMORY.md` maps areas to files.
- **Every task writes to memory by default.** At the end of each task, ask: "what should a future agent know that is neither in the code nor in `git log`?" — decisions and their reasons, rejected options, traps and remedies, working preferences. Write it in the matching topic file (update the existing entry first; delete what became false; add a short dated *decision → why → how to apply* entry otherwise), and update the index if a cross-cutting decision, an open item or a new topic file is involved. **If, exceptionally, there is nothing worth keeping, say so explicitly in the final message** ("no memory update: …") — silence is not an option.
- A **structural** choice (stack, architecture, a rule default, a protocol) also gets an ADR in `docs/DECISIONS.md`, and `docs/SPEC.md` is amended when the brief itself changes. Memory points at the ADR rather than restating it.
- The memory update is part of the task: it is staged **in the same commit** (rule 1).
- Memory is written in **English**, dense and factual; no session narration, no duplication of what the code, `git log` or this file already say; each fact stated once, cross-referenced by file name elsewhere.
- The project command `/memorize` (`.claude/commands/memorize.md`) does this consolidation on demand over a whole conversation.

@MEMORY.md

## Rule 3 — Report the project's state (MANDATORY)

The register of what is open is the private `second-brain` repository: one
folder per project, filed by group and domain and found by its slug (`tamalou`
here), whose `README.md` carries a typed front matter (`state`, `point`,
`repos`) and a `## To do` list of checkboxes. `PROJECTS.md` at its root is
GENERATED from those folders. That register is the source of truth — not this
conversation, not Claude's memory, not `git log`, which records what changed
and never what state the project is in.

A session that changes code here changes this project's state, and the state
reaches the register **through this repository: never touch `second-brain`**.
Do not attach it (`add_repo`), do not clone it, do not commit to it — locally
either, even though it sits beside this checkout. On every push to `main`,
`.github/workflows/registry.yml` reads the block below from the merged pull
request's description (or, when there is none, from the pushed commits'
messages) and sends it to `second-brain`, whose own workflow updates the fiche
and regenerates `PROJECTS.md`. Only what reaches `main` is reported.

Write the block in a cloud session in this repository's pull request
description, **inside an HTML comment** so the rendered pull request stays
clean and its French does not mix with an English description. The labels are
English, what follows them is French:

    <!-- Registry
    Project: tamalou
    Last point: <the project as it now stands, in French>
    - [x] <an existing box this work closes, copied from the fiche>
    - [ ] <a new open action, in French>
    Log: <one line for the fiche's log, in French>
    -->

In a local session, write the same lines at the end of the task's commit body,
after a line `Registry:`.

Every line but the first is optional. `Last point:` REPLACES the fiche's
paragraph: write what someone back after three months needs about the whole
project, not a changelog — the commit body already carries the detail. A
`- [x]` ticks a box only when its text matches one; copy it from the fiche
when you can read it (locally `../second-brain`, or through GitHub when the
session already has it — never attach it just to read it), otherwise leave the
ticking to the maintainer. A new box is one gesture, not a plan. The date is
the merge's, and `state:` is never written by a block: it is the
maintainer's call.

**Hidden is not private.** The API hands a pull request's description and a
commit's message to anyone who can read the repository. In a **public**
repository the block carries only what is already public: the `Project:` line,
ticked boxes (`- [x]`) and one `Log:` line — never a `Last point:`, never an
open box, nothing else. The `check` job of `registry.yml` checks every pull
request before it is merged: it fails on a malformed block, on a block left
visible under a heading, and, in a public repository, on any other line; and
the report strips such a line if it is merged anyway.

A change a returning reader does not need — tooling, a typo, a refactor —
carries no block. A question, an exploration or an explanation changes no
state and writes no block.

## Rule 4 — Versions and releases (MANDATORY)

The project carries **one version**, `version` in the root `package.json`, in
[Semantic Versioning](https://semver.org/spec/v2.0.0.html): `MAJOR.MINOR.PATCH`.
`CHANGELOG.md` says what each release brings to the people who use the
project, newest first, in the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
shape. **It is written in English, like the code, even here where the
project speaks French first.** Each release has a **codename**: here a French card word,
in alphabetical order (0.1.0 As, 0.2.0 Brelan… 0.8.0 Honneur; the next starts
with I).

- **Every pull request that changes what users get** adds its lines under
  `## [Unreleased]` (`### Added`, `### Changed`, `### Fixed`, `### Removed`,
  `### Security`), written for a user, not a developer. Tooling, a refactor or
  a test adds nothing there. It does not touch the version.
- **A release is its own pull request**, made when the owner asks for one: it
  moves the `Unreleased` lines under `## [x.y.z] - YYYY-MM-DD — Codename` and
  sets `package.json` to the same version, nothing else. PATCH for fixes only;
  MINOR for anything new; MAJOR when something users relied on stops working
  (stored data that does not carry over, a link, a protocol, a removed
  feature). Before 1.0.0, MINOR covers both. A new MINOR or MAJOR takes a new
  codename, never reused; a PATCH keeps its minor's. When a milestone ends or
  `Unreleased` holds something worth announcing, say so in the final message:
  the owner decides when to release.
- **Never tag nor publish a release by hand.** On `main`,
  `.github/workflows/release.yml` gives every section that has none its tag
  `vX.Y.Z` and its GitHub Release; on every pull request its `check` job
  refuses a `CHANGELOG.md` that disagrees with `package.json` or breaks the
  shape. Run `node .github/release.mjs check` before pushing a release.
- **A backfilled release** — a version given after the fact to a past state —
  is a section placed at its rank in the file, with
  `<!-- commit: <full sha> -->` right under its heading; the workflow tags that
  commit. It never rewrites a section that already has its release.
- **A repo that serves a page shows its version** where a user can find it (a
  footer, an about line, a settings screen), read from `package.json` at build
  time, so a phone in hand says which build it runs.

## Verification — trust the disk, not the context

- A tool answering "success" is not proof. Before saying a change is done, prove it through the repo: `git status --porcelain`, `git diff`, `grep` for the expected value, `git show HEAD:<file>` compared to the file on disk.
- What you hold in context (an earlier `Read`, an old `ls`, a summarised conversation) can be **stale**. Signature: `git status` clean right after an announced change. Re-read from disk before concluding.
- Never state an absence ("this feature is missing", "that file does not exist") without a `git`/`grep` check made in the current turn.

## Other rules

- Never rewrite history (`rebase -i`, `commit --amend`, `reset --hard`, `push --force`, `filter-repo`) without an explicit request. Do not modify `.git/config`, the hooks or branch settings.
- **The engine is pure.** `packages/engine` imports nothing from the DOM, Node, the network or a UI library; its only dependency is `@tamalou/shared`. It is a reducer `(state, action, rules) → { state, events }` with a seeded RNG carried in the state, so a game replays from its seed and its action list.
- **No hard-coded rule.** Every rule the engine applies is read from the `RuleSet` (`packages/shared`, Zod schema, versioned). A new rule or an ambiguous one becomes a `RuleSet` field with the default the spec describes; never invent a rule silently — ask the owner, and record the default in `docs/DECISIONS.md`.
- **Hidden information.** Anything that leaves the engine towards a player — a UI, a bot, a socket — goes through `viewFor(state, playerId)`. A bot never reads the full state. The server never sends anything but a view. The property tests check that a view contains nothing its player may not know: keep them passing, extend them with every new piece of state.
- **Business logic lives in `packages/`**, never in `apps/`: the apps adapt it (React, sockets, Durable Objects).
- **User-facing text is French first and English**, through the i18n dictionaries (`apps/web/src/i18n/fr.ts`, `en.ts`) with the pages' heads in `apps/web/build/site.ts`; French is the default. Code, identifiers, commits, memory, ADRs and `CHANGELOG.md` are English.
- **Visual identity comes from Versus** (`costardrouge/versus`, `src/tokens.css`): its tokens, light and dark themes and fonts. The card face is isolated behind a card theme so the owner can plug in his own decks later — never draw a card outside it.

## Related files

- `AGENTS.md`: a symlink to this file, for tools that do not read `CLAUDE.md`.
- `MEMORY.md` + `docs/memory/`: project long-term memory (rule 2).
- `docs/SPEC.md`: the brief, kept current. `docs/DECISIONS.md`: the ADRs.
- `CHANGELOG.md`: what each release brings (rule 4); `.github/release.mjs` + `.github/workflows/release.yml` tag and publish it.
