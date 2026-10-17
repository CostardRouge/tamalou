import type { Card, RuleSet } from '@tamalou/shared';

/** A card's points under the rules: the first matching override, else its rank's value. */
export function cardValue(card: Pick<Card, 'rank' | 'suit'>, rules: RuleSet): number {
  for (const o of rules.values.overrides) {
    if (o.rank !== card.rank) continue;
    if (o.suits.length === 0 || (card.suit !== null && o.suits.includes(card.suit))) return o.value;
  }
  return rules.values.byRank[card.rank];
}

export function handValue(cards: readonly (Card | null)[], rules: RuleSet): number {
  return cards.reduce((sum, c) => sum + (c ? cardValue(c, rules) : 0), 0);
}
