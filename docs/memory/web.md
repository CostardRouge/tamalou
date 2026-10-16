# Web app

`apps/web`: React 19 + Vite 8 + Motion (ADR-0003). Read before touching a screen, the connection, the dictionaries or the build.

## Shape (2026-10-16)

- `connection/`: `GameConnection` is all the UI knows (view, events, send, continueRound, subscribe). `LocalConnection` wraps a `@tamalou/room` `Table` with the real clock; `RemoteConnection` (M6) will speak WebSocket behind the same interface.
- `game/interaction.ts` derives every touchable card and every button from `legalActions(view)`: the screen offers exactly what the engine accepts. Two-touch moves (Jack blind swap, an opponent's card in a quick discard, choose-mode initial peek) are a local `Pending` state, dropped whenever the phase, step, current player or discard top changes.
- `cards/`: `CardTheme` (Face, Back) behind a React context; `CardView` flips with Motion and is a real `<button>` with a French label when playable. Never draw a card elsewhere (ADR-0007).
- `i18n/`: `fr.ts` is the source of keys, `en.ts` is typed against it (`?lang=en` until a switch exists, M8); `test/i18n.test.ts` checks keys and placeholders match. Plurals are `_one`/`_other` keys through `plural()` (French counts 0 as singular).
- Separate `apps/web/tsconfig.json` (DOM + JSX); the root `pnpm typecheck` runs both. `pnpm check` now also builds.

## Decisions and traps (2026-10-16)

- **Quick discard is an armed mode**: a "⚡ Défausse rapide" button, then a touch on the card. A tap on one's own card during the draw step would otherwise be ambiguous (and a mis-tap costs a penalty card).
- **The log speaks to the player in the second person**: an event whose actor is me uses the key's `_you` variant (`logDrewDeck_you`: «Tu pioches.»). A shared «Tu» + third-person verb gave «Tu pioche». **How to apply**: a new log line about an actor gets both keys.
- **Dispose a game when it is replaced, never in an effect cleanup**: StrictMode runs effects twice in development and the cleanup stopped the table on screen. `App.replace()` disposes the previous connection.
- During a Jack, once my card is picked, "Passer le pouvoir" stays offered next to "Annuler" (a UI run got stuck there without it).
- Measured with Playwright at 390×844, light and dark, 2026-10-16: full games to game over through the UI, no console error. Bundle 484 kB (152 kB gzip), mostly React, Motion and Zod; trimming is M8's.
- `base: './'` in `vite.config.ts`: one build works at a domain root and under GitHub Pages' `/tamalou/` (ADR-0010).

## The game master's screen (2026-10-16)

`rules/fields.ts` lists every RuleSet leaf as a setting (path, kind, bounds, `when` to hide a sub-setting of a switched-off option); `test/rules.test.ts` fails if a RuleSet leaf has no setting, so a new rule cannot be forgotten on the screen. `setAt()` changes one leaf, then keeps the initial peek consistent (fixed mode: count = number of slots; a smaller hand drops missing slots) and validates with the schema, returning null to keep the previous rules. `rules/summary.ts` writes the active rules as short French lines and flags those that differ from Classique (`modifié`); the same summary is the editor's preview and the in-game "Règles" panel. The home screen keeps a `RulesChoice` (preset + overrides); picking a preset drops the overrides.

**Trap (2026-10-16)**: `vitest.config.ts` included only `*.test.ts`, so the `.tsx` app tests written for M3 never ran until M4 widened it to `*.test.{ts,tsx}`. **How to apply**: after adding a test file of a new kind, check it appears in the run's file list.
