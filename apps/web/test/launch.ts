import { fireEvent, screen, within } from '@testing-library/react';

// The launch screen's way to a game (home/): a mode's tile opens its panel, "Jouer" there deals the cards, and the
// deal's button skips to the table.

/** Opens a mode's panel by its title ("Seul contre des bots", "À plusieurs, un téléphone"). */
export function openMode(title: string) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${title}`) }));
}

/** The open panel. */
export const panel = () => screen.getByRole('dialog');

/** "Jouer" in the open panel, then past the deal. */
export function playFromPanel() {
  fireEvent.click(within(panel()).getByRole('button', { name: 'Jouer' }));
  skipDeal();
}

/** Past the deal, straight to the table. */
export function skipDeal() {
  fireEvent.click(screen.getByRole('button', { name: /^(Passer|Regarder mes cartes)$/ }));
}
