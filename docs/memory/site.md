# The site around the game: home page, pages, addresses

Read before touching `apps/web/index.html`, `en/`, `jouer/`, `mentions-legales/`, `build/site.ts`, `build/pages.ts`, `build/analytics.ts`, `src/landing/`, `src/legal/`, `src/audience.ts`, or anything about addresses, SEO, measurement or the service worker's scope. The decisions are ADR-0016 (pages) and ADR-0017 (legal notice, measurement).

## Shape (2026-10-17)

- `build/site.ts` lists the pages (file, address, language, kind, twin) and the site's facts; `build/pages.ts` fills each shell's `<!-- page:head -->` / `<!-- page:body -->` in a `transformIndexHtml` hook with `order: 'post'`, so Vite never rewrites what it writes (relative icon paths per folder, the inline redirect script, JSON). A new page = a shell, a row in `PAGES`, its texts; `test/pages.test.ts` checks shells, relative links, hreflang, words in the HTML.
- `src/landing/text.ts` is the home page's dictionary (French source, English typed against it), read by `markup.ts` at build time and by the live table in the browser. Texts inserted into HTML may carry entities and `<em>`; texts React renders (captions, `liveSplash`) must use the `\u00a0` escape, never `&#160;`.
- The live table (`src/landing/live.tsx`) is a script of 12 scenes, not the engine: `place(def, scene)` says where each card is. Cards are `CardView` scaled from a 66px base; captions and step starts follow `DURATIONS`. It pauses off screen and when the tab is hidden; the visitor can pause or jump to a step.
- One React root on the home page renders the live table and, through portals, every `[data-card]` slot (values, powers), so the cards come from the card theme. The preset buttons are plain DOM.
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
- The website id is empty in `build/site.ts` on purpose: the owner creates the site in Umami and sets the repository variable `UMAMI_WEBSITE_ID`; `deploy.yml` passes it to both production builds. An empty variable means no measurement. Contact address: `pommier.steeve+tamalou@gmail.com`, on the pattern of Versus's (owner to confirm).
- **Trap (2026-10-17)**: a local build with a test id and `VITE_UMAMI_DOMAINS=localhost` loads the real tracker and posts to the real instance (it answered 400 for the fake id). For an end-to-end check, intercept `insight.steevepommier.com` in Playwright (`context.route`) on every page, as Versus's check did, never only some of them. Verified that way 2026-10-17: home → Play → a solo game → an old `/#room=` link (forwarded to `jouer/`) → legal notice → switch off gave exactly the expected views and one `game-started`, and no tracker request afterwards.

## Variants (2026-10-17)

The owner asked for several home pages to choose from. Three were drawn on a Claude Design canvas (https://claude.ai/artifact/HLFy6j4DoTsqsKTAgeqpZk, private to the owner): **A, the live table** (shipped here), **B, play your first round** (an interactive guided round against one bot on the page, with a checklist of the seven moves), **C, the poster** (big type on cobalt, a "how much is this hand worth" quiz, flip cards for the powers, rule sliders). Until the owner picks, A is the page; B or C would replace `markup.ts`/`live.tsx`, not the plumbing.
