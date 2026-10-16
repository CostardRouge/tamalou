# Design

## Visual identity from Versus (2026-10-16)

The owner likes Versus's charter and asked for it here (ADR-0007). Source: `costardrouge/versus`, `src/tokens.css` and its fonts. **How to apply**: copy the tokens (`--bg`, `--surface`, `--surface-2`, `--ink`, `--muted`, `--line`, `--field`, `--a` cobalt, `--b` coral, `--b-ink`, `--good`, `--good-ink`, `--bad`, `--on-accent`, `--shadow`, radii) with their light values on `:root`, dark ones under `prefers-color-scheme` guarded by `:not([data-theme="light"])` and again under `[data-theme="dark"]`; Bricolage Grotesque (display), Figtree (body), JetBrains Mono (numbers, tabular), self-hosted with Fontsource. No literal colours in components. Versus checks contrast in `tests/tokens.test.ts` (text 4.5:1, fields and accents 3:1): port that test with the tokens.

## Card theme (2026-10-16)

The owner designs his own decks in another project and wants to plug them in later. Every card face and back is drawn by a card theme component behind one interface; nothing else in the UI knows what a card looks like. Suits are never told apart by colour alone (symbol + label), and each card has a screen-reader label.
