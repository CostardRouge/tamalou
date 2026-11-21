import { type Key, t } from '../i18n/index.ts';
import { Icon } from './ActionBar.tsx';
import { type ActivePower, powerMarks } from './power.ts';

// A power's picture (an eye for a look, two arrows for a swap, both for the Queen) and its words, for the table's
// callout, the card I hold and the seat of whoever plays one (game/power.ts).

export function PowerMark({ power }: { power: ActivePower }) {
  return (
    <span className="power-mark" aria-hidden="true">
      {powerMarks(power).map((m) => (
        <Icon key={m} name={m} />
      ))}
    </span>
  );
}

/** What the power does, said to its player ("Regarde une de tes cartes") or about another ("Regarde une de ses…"). */
export const powerWords = (power: ActivePower, mine: boolean) => t(`powerDo_${power}${mine ? '_you' : ''}` as Key);
