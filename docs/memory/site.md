# The site around the game: home page, pages, addresses

Read before touching `apps/web/index.html`, `en/`, `jouer/`, `build/site.ts`, `build/pages.ts`, `src/landing/`, or anything about addresses, SEO or the service worker's scope. The decision is ADR-0016.

## Shape (2026-10-17)

- `build/site.ts` lists the pages (file, address, language, kind, twin) and the site's facts; `build/pages.ts` fills each shell's `<!-- page:head -->` / `<!-- page:body -->` in a `transformIndexHtml` hook with `order: 'post'`, so Vite never rewrites what it writes (relative icon paths per folder, the inline redirect script, JSON). A new page = a shell, a row in `PAGES`, its texts; `test/pages.test.ts` checks shells, relative links, hreflang, words in the HTML.
- `src/landing/text.ts` is the home page's dictionary (French source, English typed against it), read by `markup.ts` at build time and by the live table in the browser. Texts inserted into HTML may carry entities and `<em>`; texts React renders (captions, `liveSplash`) must use ` `, never `&#160;`.
- The live table (`src/landing/live.tsx`) is a script of 12 scenes, not the engine: `place(def, scene)` says where each card is. Cards are `CardView` scaled from a 66px base; captions and step starts follow `DURATIONS`. It pauses off screen and when the tab is hidden; the visitor can pause or jump to a step.
- One React root on the home page renders the live table and, through portals, every `[data-card]` slot (values, powers), so the cards come from the card theme. The preset buttons are plain DOM.
- Language: the home page sets the game's language in memory only (`setLang(lang, false)`) for the card letters; a click on Play or on the language link remembers it (`tamalou-lang`), as Versus does.

## Traps (2026-10-17)

- **Vite 8 is Rolldown**: multi-page inputs go in `build.rolldownOptions.input`; entry names come from the page's folder (`home`, `en`, `jouer`), the shared chunk is named after a module (`CardView-*` today). Never let a module be named `analytics`/`audience` into a shared chunk name if measurement comes (Versus's trap: filter lists block the chunk and the page with it).
- The service worker is `/sw.js`, registered from `jouer/` with `'../sw.js', { scope: '../' }`; offline, a navigation gets the cached `<folder>/index.html`, else `jouer/index.html`.
- Shared room links and rules links point at `jouer/` now (they are built from `location.pathname`); older ones at the root are forwarded by the inline script, as is an installed app whose start address was the root (`display-mode: standalone`).
- Verified 2026-10-17 with Playwright on `vite preview`: `/`, `/en/`, `/jouer/` at 390×844 and 1280×900, light and dark, no console error, no horizontal scroll.

## Variants (2026-10-17)

The owner asked for several home pages to choose from. Three were drawn on a Claude Design canvas (https://claude.ai/artifact/HLFy6j4DoTsqsKTAgeqpZk, private to the owner): **A, the live table** (shipped here), **B, play your first round** (an interactive guided round against one bot on the page, with a checklist of the seven moves), **C, the poster** (big type on cobalt, a "how much is this hand worth" quiz, flip cards for the powers, rule sliders). Until the owner picks, A is the page; B or C would replace `markup.ts`/`live.tsx`, not the plumbing.
