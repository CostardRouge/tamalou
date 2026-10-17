# Design

## Visual identity from Versus (2026-10-16)

The owner likes Versus's charter and asked for it here (ADR-0007). Source: `costardrouge/versus`, `src/tokens.css` and its fonts. **How to apply**: copy the tokens (`--bg`, `--surface`, `--surface-2`, `--ink`, `--muted`, `--line`, `--field`, `--a` cobalt, `--b` coral, `--b-ink`, `--good`, `--good-ink`, `--bad`, `--on-accent`, `--shadow`, radii) with their light values on `:root`, dark ones under `prefers-color-scheme` guarded by `:not([data-theme="light"])` and again under `[data-theme="dark"]`; Bricolage Grotesque (display), Figtree (body), JetBrains Mono (numbers, tabular), self-hosted with Fontsource. No literal colours in components. Versus checks contrast in `tests/tokens.test.ts` (text 4.5:1, fields and accents 3:1): port that test with the tokens.

## Card tokens (2026-10-16)

`apps/web/src/styles/tokens.css` is Versus's file plus `--card-face`, `--card-ink`, `--card-red`, `--card-edge`, `--card-back`, `--card-back-ink`, `--felt`. A card face stays light in the dark theme (it is a physical card); its inks are checked at 4.5:1 on it by `apps/web/test/tokens.test.ts`, with the rest of Versus's contrast checks. The dark card back had to go from #3654ff to the light theme's #2743f5 to keep its mark at 4.5:1.

## Card theme (2026-10-16)

The owner designs his own decks in another project and wants to plug them in later. Every card face and back is drawn by a card theme component behind one interface (`apps/web/src/cards/theme.ts`, provided by a React context); nothing else in the UI knows what a card looks like. The first theme, "classic", draws corner indices, a centre pip and French court letters (V, D, R) in CSS. Suits are never told apart by colour alone (symbol + label), and each card has a screen-reader label.

## Icons (2026-10-16)

C11 set in `apps/web/public/`: three SVG sources (a face-down cobalt card behind a face-up card with a coral T), PNGs drawn by `apps/web/scripts/icons.mjs` with `npm i --no-save sharp` and committed, the touch icon flattened to opaque RGB. `apps/web/test/icons.test.ts` reads the PNG headers: 180×180 colour type 2, every declared file present at its size, manifest paths relative. `display: standalone` is fine while nothing is stored that a standalone launch could lose (solo games live in memory).
