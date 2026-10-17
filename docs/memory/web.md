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

## Pass-and-play (2026-10-16)

One device, several humans (docs/SPEC.md §5.2, ADR-0012). `LocalConnection` takes a list of humans: one is solo, several share the device through `@tamalou/room`'s `Handoff`. The screen shows a player's private view only after "C'est moi, …" on the `HandoffCover` (nothing of the game is drawn on it); while no human has anything to do it shows the table as `SPECTATOR` sees it (every hand face down, all players in the top row, no "mine" grid), and the log is the public one. A quick discard on a shared screen goes "⚡ Défausse rapide" → who → that player's card, computed from that player's own view (`viewOf`) but drawn face down; only own cards can be claimed there. The home screen keeps a `mode` (`solo` | `pass`), the players' names, and `MODE_DEFAULTS` (pass-and-play: quick discard off) sit between the preset and the game master's changes (`rulesOf(choice, base)`), so the editor shows it as a setting to switch back on. Switching mode keeps the changes; picking a preset drops them.

**Traps (2026-10-16)**: `reveal()` changes what the screen shows without any table event, so React never re-rendered — `LocalConnection` now tells its own listeners on reveal. In Playwright scripts, `locator.textContent()` on an absent element waits the default 30 s (the spectator view has no `.mine`): count first, and `page.setDefaultTimeout(1500)`.

## Online rooms (2026-10-16)

The home screen offers "En ligne" only when `./api/health` answers with our protocol version (LAN server, online host); GitHub Pages has no API, so the mode stays hidden there. A room's address is `#room=CODE`, kept in the address bar while inside so a reload comes back; tokens live in `localStorage` `tamalou-rooms` (per code, a day). `RoomClient` (`connection/remote.ts`) owns the socket, reconnects with backoff (1 s → 10 s, at once on `online` / `visibilitychange`) and stops on a final `closed` reason; `RemoteConnection` adapts it to `GameConnection` (`presence()` tags disconnected / bot-played seats). `pnpm dev` proxies `/api` (WebSocket included) to a server on :8080.

**Traps (2026-10-16)**: the room client is created in an effect, not a `useState` initializer: StrictMode's double initializer would open two sockets, and a cleanup-on-unmount would dispose the live one. The online banner floats (`position: fixed`): `.game` is a six-row grid, and an extra child pushed the pile labels under the player's grid. A Playwright run of three phones found a real bug — `Table.submit` compared a held-back draw to `legalActions` with `JSON.stringify`, and an action arriving over the network orders its keys differently, so every early draw was refused as `illegal`; actions are now compared on sorted keys (test in `room.test.ts`). A second tap on a draw already held back is refused `alreadyDrawing`; the client shows no notice for it.

## Polish (M8, 2026-10-16)

ADR-0015. `feedback/cues.ts` (pure, tested) maps events to one cue per batch and lists the slots a move touched; `feedback/useFeedback.ts` plays it and drives the flash and the splash; `feedback/settings.ts` holds sound/haptics (`tamalou-settings`); the language is `tamalou-lang`, changed through `setLang`, which tells `App` to draw again (no remount: games and rooms keep going). Preset names and descriptions come from the dictionaries (`presetText`), the shared package keeps the French ones as fallback. `build/pwa.ts` writes `dist/sw.js`; `src/pwa.ts` registers it in production builds only and keeps the install prompt for the Settings block. Verified in Chromium: page reloaded offline, solo game played offline, English switch, splash, both themes.

**Traps (2026-10-16)**: an effect that runs after every render must keep its timers in a ref — its own cleanup would cancel them at the next render (the flash never went away). The first service worker install takes control through `clients.claim()`, so "a controller exists" does not mean "an update": compare with the controller present when the page loaded. Audio only starts after a user gesture: the context is resumed on the first `pointerdown`/`keydown`.

## The table's height and the pinned screen (2026-10-17)

**Bug reported from an iPhone**: the deck and discard overlapped the opponents' seats (Safari's toolbars leave about 390×660). Card widths derive from `--unit`, computed from `100dvh` as well as `vw` (constants in `app.css`); more than three opponents set `--opp-rows: 2` and the class `game-crowded`.

**The owner's rule: the page never moves during a game** («ça sera chiant si on veut bouger une carte et que c'est la page qui bouge»). So `.game` is `position: fixed; inset: 0`, `overflow: hidden`, `touch-action: none`, no text selection or long-press callout, and `html:has(.game)` blocks document scroll and pull-to-refresh. Nothing may rely on page scroll on the table: what must scroll does it in its own box with `touch-action: pan-y` (`.journal`, `.panel`, and `.opponents`). Do not reintroduce `min-height: 100dvh` + page scroll (the first fix did, it was reverted the same day).

**Fitting without scroll**: the grid rows are `auto auto minmax(0, max-content) 1fr auto auto` so the opponents' band is the one that gives way (it scrolls inside itself) while the centre, your cards and the buttons stay whole; `.center` must keep `min-height: auto` (with `0` it collapsed to nothing). Five opponents under 640px tall line their cards up 1×4 (`--opp-cols`), halving their seats. Since the one-line action bar, only 320px-wide phones with five opponents (three rows of seats) get their band clipped into its own scroll.

**How to check a layout change**: Playwright over 390×664, 375×560, 360×640, 430×740, 320×568, 360×520, 390×844 and a tablet, with 2 and 5 bots, comparing the boxes of `.opponents`, `.center`, `.mine`, `.controls` cards, `.game`'s overflow and the controls' bottom against `innerHeight`. To test touch, send raw `Input.dispatchTouchEvent` sequences over CDP: `Input.synthesizeScrollGesture` did not scroll even a scrollable panel, so it proves nothing.

## The action bar (2026-10-17)

The owner picked design A of the "actions sur une seule ligne" exploration: the bar never wraps. `game/ActionBar.tsx` draws a list of `Act`s: the main one (`main`, else the first with an icon) is the wide button, every other action a 56px square icon with a one-word caption (`bar*` keys) and the full label as its accessible name, so tests and screen readers still find "Prendre la défausse". Plain choices without an icon (pass-and-play: who claims) stay text buttons, and the line scrolls sideways (`touch-action: pan-x`) rather than wrap. `actsFor()` in `GameScreen.tsx` replaced `buttons()`; the end-of-round panel keeps the wrapping `.buttons`. Emoji left the bar (icons are inline stroke SVG).

## Spotlight and confirmation (2026-10-17)

ADR-0016. `.game` carries `turn-mine` / `turn-other` and `choosing`; the fade of untouchable cards sits on `.card`, never on `.card-inner`: opacity or filter on a `preserve-3d` element flattens it and the face-down back (rotated 180°, `backface-visibility: hidden`) vanished. A staged move (`staged` in `GameScreen.tsx`, question from `game/confirm.ts`) is dropped with the pending selection on every step change, so a quick discard staged too late cannot be sent against another top card. The new `turnBanner` key exists because `yourTurn` was already taken.
