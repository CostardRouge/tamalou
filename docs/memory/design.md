# Design

## Visual identity from Versus (2026-10-16)

The owner likes Versus's charter and asked for it here (ADR-0007). Source: `costardrouge/versus`, `src/tokens.css` and its fonts. **How to apply**: copy the tokens (`--bg`, `--surface`, `--surface-2`, `--ink`, `--muted`, `--line`, `--field`, `--a` cobalt, `--b` coral, `--b-ink`, `--good`, `--good-ink`, `--bad`, `--on-accent`, `--shadow`, radii) with their light values on `:root`, dark ones under `prefers-color-scheme` guarded by `:not([data-theme="light"])` and again under `[data-theme="dark"]`; Bricolage Grotesque (display), Figtree (body), JetBrains Mono (numbers, tabular), self-hosted with Fontsource. No literal colours in components. Versus checks contrast in `tests/tokens.test.ts` (text 4.5:1, fields and accents 3:1): port that test with the tokens.

## Card tokens (2026-10-16)

`apps/web/src/styles/tokens.css` is Versus's file plus `--card-face`, `--card-ink`, `--card-red`, `--card-edge`, `--card-back`, `--card-back-ink`, `--felt`. A card face stays light in the dark theme (it is a physical card); its inks are checked at 4.5:1 on it by `apps/web/test/tokens.test.ts`, with the rest of Versus's contrast checks. The dark card back had to go from #3654ff to the light theme's #2743f5 to keep its mark at 4.5:1.

## Card theme (2026-10-16)

The owner designs his own decks in another project and wants to plug them in later. Every card face and back is drawn by a card theme component behind one interface (`apps/web/src/cards/theme.ts`, provided by a React context); nothing else in the UI knows what a card looks like. The first theme, "classic", draws corner indices, a centre pip and French court letters (V, D, R) in CSS. Suits are never told apart by colour alone (symbol + label), and each card has a screen-reader label.

## Icons (2026-10-16, rev. 2026-10-19)

C11 set in `apps/web/public/`: three SVG sources (a face-down cobalt card behind a face-up card with a coral T), PNGs drawn by `apps/web/scripts/icons.mjs` with a throwaway sharp and committed, the touch icon flattened to opaque RGB. **sharp is installed beside the workspace and linked in** (`npm i --prefix /tmp/card sharp && ln -s … node_modules/`, the recipe in the script): `npm i --no-save` inside a pnpm workspace does not work — measured 2026-10-19 on a scratch workspace, npm 10 crashed in Arborist over pnpm's links (`Cannot read properties of null (reading 'edgesOut')`) and installed nothing, and a version that got further would reify the tree in its own layout. The social card is drawn the same way by `scripts/card.mjs` (`site.md`). `apps/web/test/icons.test.ts` reads the PNG headers: 180×180 colour type 2, every declared file present at its size, manifest paths relative. `display: standalone` is fine while nothing is stored that a standalone launch could lose (solo games live in memory).
