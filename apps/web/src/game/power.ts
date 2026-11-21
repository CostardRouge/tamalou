import type { Card, PlayerId, PlayerView, Power, RuleSet } from '@tamalou/shared';

// Powers made visible (the owner, 2026-11-21: «mieux montrer les pouvoirs»). Pure, so tested: which power the card I
// hold would give if I threw it, and which power is being played on the table right now, by whom.

export type ActivePower = Exclude<Power, 'none'>;

/**
 * The power my drawn card gives if I throw it, read from the rules as the engine reads them: its rank's power, from
 * the pile, or from either pile when the game master says so. Null for a card with none, or one I may not throw.
 */
export function powerIfThrown(drawn: PlayerView['drawn'], rules: RuleSet): ActivePower | null {
  if (!drawn?.card) return null;
  return powerOfCard(drawn.card, drawn.from, rules);
}

export function powerOfCard(card: Card, from: 'deck' | 'discard', rules: RuleSet): ActivePower | null {
  const power = rules.powers.byRank[card.rank];
  if (power === 'none') return null;
  return from === 'deck' || rules.powers.activation === 'anyPile' ? power : null;
}

/** The power being played: offered (a target to choose) or showing its card (a look, the Queen's choice). */
export function powerInPlay(view: PlayerView): { player: PlayerId; power: ActivePower } | null {
  if (view.phase !== 'play' || !view.current) return null;
  const power =
    view.step === 'power' ? view.pendingPower?.power : view.step === 'reveal' ? view.reveal?.power : undefined;
  return power && power !== 'none' ? { player: view.current, power } : null;
}

/** What a power's picture shows: an eye for a look, two arrows for a swap, both for the Queen. */
export const powerMarks = (power: ActivePower): ('look' | 'swap')[] =>
  power === 'peekThenSwap' ? ['look', 'swap'] : power === 'blindSwap' ? ['swap'] : ['look'];
