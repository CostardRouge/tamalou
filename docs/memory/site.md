# The site around the game: home page, pages, addresses

Read before touching `apps/web/index.html`, `en/`, `jouer/`, `mentions-legales/`, `build/site.ts`, `build/pages.ts`, `build/analytics.ts`, `src/landing/`, `src/legal/`, `src/audience.ts`, or anything about addresses, SEO, measurement or the service worker's scope. The decisions are ADR-0017 (pages) and ADR-0018 (legal notice, measurement).

## Shape (2026-10-17)

- `build/site.ts` lists the pages (file, address, language, kind, twin) and the site's facts; `build/pages.ts` fills each shell's `<!-- page:head -->` / `<!-- page:body -->` in a `transformIndexHtml` hook with `order: 'post'`, so Vite never rewrites what it writes (relative icon paths per folder, the inline redirect script, JSON). A new page = a shell, a row in `PAGES`, its texts; `test/pages.test.ts` checks shells, relative links, hreflang, words in the HTML.
- `src/landing/text.ts` is the home page's dictionary (French source, English typed against it), read by `markup.ts` at build time and by the scripts in the browser. Everything is plain text with the `\u00a0` escape for no-break spaces (never an HTML entity: React would print it); `<em>` only in `heroTitle`. `cardWords()` names a card in a sentence ("un Roi rouge", "an 8").
- **The first round** (2026-10-17, the owner's pick, direction B): `tutorial.ts` is a pure reducer over a fixed deck (`step(state, action) → { state, after }`, `after` = a timed step the page plays after a pause); `tutorial.tsx` draws it — coach, checklist of the seven moves, a 520×560 table zoomed down on phones — with `CardView` cards that are real buttons when touchable. The deck is chosen so a sensible player meets every move and wins; `test/landing.test.ts` plays it through, and a quick discard is offered only when Malo throws a rank you *know* you hold. A wrong quick-discard tap is forgiven, and the coach says the real rule.
- **The hand quiz** (`quiz.tsx`, taken from direction C at the owner's request, placed right after the round): five fixed hands, three totals each, values from `pointsOf`, which the test checks against the engine's.
- `main.tsx` mounts the round into `#manche` (replacing the static first step written by `markup.ts`) and the quiz into `#quiz`.
- Language: the home page sets the game's language in memory only (`setLang(lang, false)`) for the card letters; a click on Play or on the language link remembers it (`tamalou-lang`), as Versus does.

## Traps (2026-10-17)

- **Vite 8 is Rolldown**: multi-page inputs go in `build.rolldownOptions.input`; entry names come from the page's folder (`home`, `en`, `jouer`), shared chunks are named after a module (`CardView-*`, and `remember-*` which carries `src/audience.ts` today). Check after a build that no chunk is named `analytics`/`audience`/`tracker` (Versus's trap: filter lists block the chunk and every page with it).
- The service worker is `/sw.js`, registered from `jouer/` with `'../sw.js', { scope: '../' }`; offline, a navigation gets the cached `<folder>/index.html`, else `jouer/index.html`.
- Shared room links and rules links point at `jouer/` now (they are built from `location.pathname`); older ones at the root are forwarded by the inline script, as is an installed app whose start address was the root (`display-mode: standalone`).
- Verified 2026-10-17 with Playwright on `vite preview`: `/`, `/en/`, `/jouer/` at 390×844 and 1280×900, light and dark, no console error, no horizontal scroll.

## Legal notice and measurement (2026-10-17)

- Ported from Versus (`src/audience.ts`, `build/analytics.ts`, the switch, the tests), not rewritten; Versus's `docs/analytics.md` holds the reasoning (why settings in the head, async, no preconnect, the bounded queue). Read it before changing how the tracker loads.
- **The legal notice states facts the code must keep true** (`src/legal/text.ts`): what is stored on the device (`tamalou-lang`, `tamalou-settings`, the last setup, `tamalou-rooms` tokens for a day), a room's life (memory only, 2 h idle), the per-IP room limit, the events. `test/pages.test.ts` fails when the code sends an event the list does not know; change an event, a stored key or a room's lifetime and update the notice in the same commit.
- Views: the static pages, `/jouer/` (game home), `/jouer/partie`, `/jouer/salle` (one per screen, from `App`'s effect). `game-started` is sent from the home screen, before the `/jouer/partie` view: it carries mode, bots, level, preset and `custom` (rules changed), never names.
- The website id (2026-10-17, given by the owner) is in `build/site.ts`, like Versus's: not a secret, it is in every page. `VITE_UMAMI_WEBSITE_ID` overrides it, empty turns measurement off. A LAN server's host is not in `data-domains`, so the Docker image never reports. Contact address `pommier.steeve+tamalou@gmail.com`, confirmed by the owner (2026-10-17).
- **Trap (2026-10-17)**: a local build with a test id and `VITE_UMAMI_DOMAINS=localhost` loads the real tracker and posts to the real instance (it answered 400 for the fake id). For an end-to-end check, intercept `insight.steevepommier.com` in Playwright (`context.route`) on every page, as Versus's check did, never only some of them. Verified that way 2026-10-17: home → Play → a solo game → an old `/#room=` link (forwarded to `jouer/`) → legal notice → switch off gave exactly the expected views and one `game-started`, and no tracker request afterwards.

## Variants (2026-10-17)

Three directions were drawn on a Claude Design canvas (https://claude.ai/artifact/HLFy6j4DoTsqsKTAgeqpZk, private to the owner): A, a round that plays itself; B, play your first round; C, a poster with a hand quiz. **The owner chose B, with C's quiz inserted right after the first block.** A shipped first and was removed; don't bring back a self-playing table without asking.
