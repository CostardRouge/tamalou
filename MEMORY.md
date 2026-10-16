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
- Later, out of scope for now: advanced variants, the owner's own card designs, statistics and game history.

## Decisions at a glance (details in `docs/DECISIONS.md` and the topic files)

- Commits follow the common spec's C3 (English imperative title, no `feat:` prefix), not Conventional Commits — ADR-0001.
- pnpm monorepo, packages ship TS sources, one typecheck, Biome + Vitest — ADR-0002, `architecture.md`.
- Front: React 19 + Vite + Motion — ADR-0003.
- Servers: a Node `ws` server for LAN (Docker on the homelab) AND a Cloudflare Worker + Durable Objects for online, both thin adapters over the pure `packages/room` — ADR-0004, `architecture.md`.
- Quick discard window: open from a card landing on the discard until the next player draws (2 s minimum); off by default in pass-and-play — ADR-0005, `rules.md`.
- Defaults for the brief's unspecified rule points — ADR-0006, `rules.md`.
- Visual identity reused from Versus; card faces behind a theme — ADR-0007, `design.md`.

## Open items

- 2026-10-16 — `bin/registry-setup.sh tamalou` must be run by the owner (from his machine) so `registry.yml`'s `send` job can report; until then it says so and stays green.
- 2026-10-16 — The online host's domain (a subdomain of steevepommier.com?) and the Cloudflare account variables are to be decided at M6.

## Topic files

| file | read when |
| --- | --- |
| `docs/memory/architecture.md` | touching the package layout, the engine/room/transport split, the servers |
| `docs/memory/rules.md` | touching the `RuleSet`, a rule's default, presets, the engine's resolution order |
| `docs/memory/design.md` | touching the UI's look, tokens, fonts, the card theme |
