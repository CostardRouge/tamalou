// The names strangers see (ADR-0029): drawn by the server, never typed, so nothing a player writes reaches someone they
// do not know and there is nothing to moderate. A name is stored as three numbers (a card, an adjective, 0–999) and
// written in the reader's language: «Dame Rusée 057», "Sly Queen 057". A new language adds its words here.

export interface NameWords {
  /** The thirteen cards, Deux to As, with the gender the adjective agrees with. */
  cards: readonly (readonly [word: string, gender: 'm' | 'f'])[];
  /** The adjectives, masculine then feminine. */
  adjectives: readonly (readonly [m: string, f: string])[];
  /** Where each part goes. */
  pattern: string;
}

const fr: NameWords = {
  cards: [
    ['Deux', 'm'],
    ['Trois', 'm'],
    ['Quatre', 'm'],
    ['Cinq', 'm'],
    ['Six', 'm'],
    ['Sept', 'm'],
    ['Huit', 'm'],
    ['Neuf', 'm'],
    ['Dix', 'm'],
    ['Valet', 'm'],
    ['Dame', 'f'],
    ['Roi', 'm'],
    ['As', 'm'],
  ],
  adjectives: [
    ['Rusé', 'Rusée'],
    ['Malin', 'Maligne'],
    ['Pressé', 'Pressée'],
    ['Discret', 'Discrète'],
    ['Tranquille', 'Tranquille'],
    ['Vif', 'Vive'],
    ['Futé', 'Futée'],
    ['Calme', 'Calme'],
    ['Hardi', 'Hardie'],
    ['Patient', 'Patiente'],
    ['Audacieux', 'Audacieuse'],
    ['Prudent', 'Prudente'],
    ['Joueur', 'Joueuse'],
    ['Rêveur', 'Rêveuse'],
    ['Fier', 'Fière'],
    ['Taquin', 'Taquine'],
  ],
  pattern: '{card} {adj} {num}',
};

const en: NameWords = {
  cards: [
    ['Two', 'm'],
    ['Three', 'm'],
    ['Four', 'm'],
    ['Five', 'm'],
    ['Six', 'm'],
    ['Seven', 'm'],
    ['Eight', 'm'],
    ['Nine', 'm'],
    ['Ten', 'm'],
    ['Jack', 'm'],
    ['Queen', 'f'],
    ['King', 'm'],
    ['Ace', 'm'],
  ],
  adjectives: [
    ['Sly', 'Sly'],
    ['Clever', 'Clever'],
    ['Hasty', 'Hasty'],
    ['Quiet', 'Quiet'],
    ['Calm', 'Calm'],
    ['Quick', 'Quick'],
    ['Canny', 'Canny'],
    ['Steady', 'Steady'],
    ['Bold', 'Bold'],
    ['Patient', 'Patient'],
    ['Daring', 'Daring'],
    ['Careful', 'Careful'],
    ['Playful', 'Playful'],
    ['Dreamy', 'Dreamy'],
    ['Proud', 'Proud'],
    ['Cheeky', 'Cheeky'],
  ],
  pattern: '{adj} {card} {num}',
};

export const NAME_WORDS = { fr, en } as const;
export type NameLang = keyof typeof NAME_WORDS;
export const NAME_LANGS = Object.keys(NAME_WORDS) as NameLang[];

const CARDS = fr.cards.length;
const ADJECTIVES = fr.adjectives.length;

export interface RankedName {
  card: number;
  adj: number;
  num: number;
}

const pick = (random: () => number, n: number) => Math.min(n - 1, Math.floor(random() * n));

/** A new name, as stored: "card.adjective.number". */
export function drawName(random: () => number = Math.random): string {
  return `${pick(random, CARDS)}.${pick(random, ADJECTIVES)}.${pick(random, 1000)}`;
}

/** A stored name's parts, or null when it is not one. */
export function parseName(key: string): RankedName | null {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{1,3})$/.exec(key);
  if (!m) return null;
  const [card, adj, num] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return card < CARDS && adj < ADJECTIVES ? { card, adj, num } : null;
}

/** A stored name in a language; the key itself when it does not read (it never should). */
export function nameText(key: string, lang: NameLang = 'fr'): string {
  const n = parseName(key);
  const words = NAME_WORDS[lang];
  const card = n && words.cards[n.card];
  const adj = n && words.adjectives[n.adj];
  if (!n || !card || !adj) return key;
  return words.pattern
    .replace('{card}', card[0])
    .replace('{adj}', card[1] === 'f' ? adj[1] : adj[0])
    .replace('{num}', String(n.num).padStart(3, '0'));
}
