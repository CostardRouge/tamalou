import { fireEvent, screen, within } from '@testing-library/react';

// The launch screen's way to a game (home/): a mode's tile opens its panel, and "Jouer" there opens the table, where
// the cards are dealt.

/** Opens a mode's panel by its title ("Seul contre des bots", "À plusieurs, un téléphone"). */
export function openMode(title: string) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${title}`) }));
}

/** The open panel. */
export const panel = () => screen.getByRole('dialog');

/** "Jouer" in the open panel. */
export function playFromPanel() {
  fireEvent.click(within(panel()).getByRole('button', { name: 'Jouer' }));
}
