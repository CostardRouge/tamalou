// The game's tests read the screens in French, the language a French browser opens the game in (ADR-0028: the game
// opens in the browser's language). jsdom and Node both say en-US; the detection itself is tested in i18n.test.ts.
if (globalThis.navigator) {
  Object.defineProperty(globalThis.navigator, 'languages', { value: ['fr-FR', 'fr'], configurable: true });
}
