# The ranked mode

ADR-0029 decides it, `docs/plans/ranking.md` holds the evaluation, the owner's picks and the steps R0–R3. This file keeps
what the code does not say.

## R0, the ranked profile (2026-11-27)

**Shipped**: `packages/ranking` (identity, names, `Ladder`, `ladderRequest`), the Worker's `LadderObject` and
`/api/ladder/:op`, the `/admin/` card (players, last export, `ladder.json`, `ladder/import`), the «Classé» tile and
screen (`apps/web/src/ranked/`), the legal notice's «Profil classé» section (`#classement`).

- **The secret is drawn on the device, the server keeps SHA-256 of it.** 25 symbols of Crockford base 32 (125 bits):
  no slow hash needed, it is not a chosen password. Typed back, case, spaces, dashes, O/I/L are forgiven
  (`normalizeCode`). It travels only in POST bodies, never in a path. **How to apply**: never log a request body on
  `/api/ladder/*`; never add a «send me my code» path (there is no contact to send it to, by design).
- **The name is stored as three numbers** («card.adjective.number», e.g. `10.0.57`) and written per language by
  `nameText` (`NAME_WORDS`, French gendered: «Dame Rusée», "Sly Queen"). **Why**: nine languages are coming
  (ADR-0028) and a stored French string would show in French everywhere. **How to apply**: a new language adds its
  13 cards and 16 adjectives to `NAME_WORDS` (the test checks every list has as many); never let a player type the
  name strangers see.
- **The player sees no μ/σ**; the data download has them (it is their data). The ladder's export keeps the hashes,
  so a restored ladder still opens with everyone's code; `importFile` adds only players missing by id or hash, never
  overwrites.
- **Retention**: `pruneDaily` on the first call of a UTC day deletes players whose `COALESCE(last_game, created)` is
  13 months old. R1 must set `last_game` (and add the ranked games' table, pruned the same way).
- **The screen shows only on the online Worker** (`serverMode() === 'online'`, App's `server` state): the LAN server
  and GitHub Pages have no ladder. A profile the server no longer knows (deleted elsewhere, pruned) is forgotten on
  the device with a notice.

## Traps

- **RPC and `unknown`**: a Durable Object method returning `{ body?: unknown }` types as `never` on the stub
  (Workers' serialisable types). `LadderObject` returns JSON **text** (`handle` → `{ status, json }`, `exportFile` →
  string, `importFile(text)`).
- **`node:sqlite` in tests**: `Ladder` runs over a two-method `Sql` interface; the package tests use `DatabaseSync`
  (`prepare(q).all(...b)` also runs DML), with Node's ExperimentalWarning in the output (harmless, Node 22 in the
  container). In a **jsdom** test Vite refuses to bundle a Node built-in: `process.getBuiltinModule('node:sqlite')`
  at run time (`apps/web/test/ranked.test.tsx`, which runs the real `ladderRequest` behind a stubbed `fetch`).
- **Parameter properties** (`constructor(private sql)`) fail `erasableSyntaxOnly`: assign fields by hand.
- **Checked 2026-11-27** with `wrangler dev` (create, 409 on the same secret, a loose code, rename, data, delete,
  405/400) and Playwright at 390 px in both themes against it (create, the code, «C'est noté», a second context
  restoring by the code, delete). **Not checked live**: `/admin/ladder.json` and the import form (no Sésame stand-in
  this time; the page itself is unit-tested).
- Running a Playwright script by absolute path from the repo writes its relative `shots/` **into the repo**: `cd` to
  the scratchpad first.
