import type { Messages } from './fr.ts';

// The development pseudo-language (`?lang=xx-long`, docs/plans/languages.md § 5), never offered to players: every
// French text with its letters accented, each word 40 % longer, the whole between brackets. A text on screen without
// brackets did not go through t(); a button that overflows will overflow in German. Placeholders stay as they are.

const ACCENTED: Record<string, string> = Object.fromEntries(
  [...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((c, i) => [
    c,
    [...'åƀçđéƒĝĥîĵķļɱñöþǫŕšţûṽŵẋýžÅƁÇĐÉƑĜĤÎĴĶĻṀÑÖÞǪŔŠŢÛṼŴẊÝŽ'][i] ?? c,
  ]),
);

/** One word, accented and lengthened by 40 % (its last letter repeated). */
function word(w: string): string {
  const letters = [...w];
  const extra = Math.round(letters.length * 0.4);
  const accented = letters.map((c) => ACCENTED[c] ?? c).join('');
  return accented + (ACCENTED[letters.at(-1) ?? ''] ?? letters.at(-1) ?? '').repeat(extra);
}

/** A French text in the pseudo-language: `{placeholders}` untouched, everything else accented and longer. */
export function pseudoText(text: string): string {
  const body = text
    .split(/(\{\w+\})/)
    .map((part) => (/^\{\w+\}$/.test(part) ? part : part.replace(/\p{L}+/gu, word)))
    .join('');
  return `[${body}]`;
}

/** The whole dictionary in the pseudo-language; the card letters and the bots' names stay short and as they are. */
export function pseudoMessages(fr: Messages): Messages {
  const keep = (key: string) => key.startsWith('short_') || key === 'botNames';
  return Object.fromEntries(
    Object.entries(fr).map(([key, text]) => [key, keep(key) ? text : pseudoText(text)]),
  ) as Messages;
}
