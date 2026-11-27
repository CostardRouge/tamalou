import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { LANGUAGES, type Lang } from '@tamalou/shared/languages';

/**
 * The translations kept in step with French (ADR-0028, docs/plans/languages.md § 3): three catalogs, each a French
 * source and one file per language typed against it — the game's dictionary, the home page's texts, the legal
 * notice's. `src/i18n/lock.json` records, for each language and key, a fingerprint of the French it was translated
 * from: when the French changes, the key is stale until translated again and stamped (`pnpm i18n:stamp <code>`).
 * The tests fail on a stale, missing or unstamped key, and on a key identical to French that is not on the lists
 * below. Read by `pnpm i18n:status` / `i18n:stamp` (scripts/i18n.ts) and test/i18n.test.ts.
 */

const web = resolve(import.meta.dirname, '..');

export const CATALOGS = {
  game: 'src/i18n',
  landing: 'src/landing/text',
  legal: 'src/legal/text',
} as const;
export type Catalog = keyof typeof CATALOGS;

export const LOCK_FILE = resolve(web, 'src/i18n/lock.json');

/**
 * Keys whose text is the same in every language: names, symbols, numbers, layouts of placeholders, the icons' ids
 * (`*` stands for any part of a key).
 */
const SAME_EVERYWHERE: Record<Catalog, string[]> = {
  game: [
    'appName',
    'barCall',
    'rank_JOKER',
    'rank_2',
    'rank_3',
    'rank_4',
    'rank_5',
    'rank_6',
    'rank_7',
    'rank_8',
    'rank_9',
    'rank_10',
    'rc_count',
    'storyCard',
  ],
  landing: ['bot', 'modes.*.icon'],
  legal: [],
};

/** Keys a language writes as French does, checked one by one («Total», «Menu», «Bot» are English words too). */
const SAME_IN: Partial<Record<Lang, Partial<Record<Catalog, string[]>>>> = {
  en: {
    game: [
      'botName',
      'heroBots_one',
      'heroBots_other',
      'seatAddBot',
      'lobbyBot',
      'table',
      'points_one',
      'points_other',
      'historyPoints_one',
      'historyPoints_other',
      'actHome',
      'menuPause',
      'colTotal',
      'unitPoints',
      'unitSeconds',
      'slotNumber',
      'avatarViolet',
      'avatarNote',
      'deckCobalt',
      'deckViolet',
      'effectHolo',
      'settingsHaptics',
      'hand_arc',
      'paceNormal',
      'rule_jokers',
    ],
    landing: ['navAria', 'navModes'],
    legal: ['cookiesTitle', 'licenceTitle'],
  },
};

const matches = (patterns: readonly string[], key: string) =>
  patterns.some((p) => new RegExp(`^${p.replaceAll('.', '\\.').replaceAll('*', '[^.]+')}$`).test(key));

export const mayEqualFrench = (lang: Lang, catalog: Catalog, key: string) =>
  matches(SAME_EVERYWHERE[catalog], key) || matches(SAME_IN[lang]?.[catalog] ?? [], key);

/** Nested texts (the home page's lists of modes, quiz hands…) as one flat record: `modes.0.t`. */
export function flatten(value: unknown, prefix = ''): Record<string, string> {
  if (typeof value === 'string') return { [prefix]: value };
  if (value === null || typeof value !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) Object.assign(out, flatten(v, prefix ? `${prefix}.${k}` : k));
  return out;
}

/** The fingerprint of a French text: 12 hex digits of its SHA-256. */
export const fingerprint = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 12);

/** A catalog's file in a language, flattened, or null when the language has none yet. */
export async function readCatalog(catalog: Catalog, lang: Lang): Promise<Record<string, string> | null> {
  const file = resolve(web, CATALOGS[catalog], `${lang}.ts`);
  if (!existsSync(file)) return null;
  const mod = (await import(pathToFileURL(file).href)) as { default?: unknown };
  return flatten(mod.default);
}

export type Lock = Partial<Record<Lang, Partial<Record<Catalog, Record<string, string>>>>>;

export function readLock(): Lock {
  return existsSync(LOCK_FILE) ? (JSON.parse(readFileSync(LOCK_FILE, 'utf8')) as Lock) : {};
}

export interface CatalogStatus {
  /** The language has no file for this catalog. */
  absent: boolean;
  /** In French, not in the language. */
  missing: string[];
  /** Translated, then its French changed. */
  stale: string[];
  /** Never stamped: translated, but lock.json does not say from which French. */
  unstamped: string[];
  /** Written exactly as in French, and not on the lists of names and symbols. */
  same: string[];
}

export type LangStatus = Record<Catalog, CatalogStatus>;

/** Where a language stands against French, catalog by catalog. */
export async function status(lang: Lang, lock: Lock = readLock()): Promise<LangStatus> {
  const out = {} as LangStatus;
  for (const catalog of Object.keys(CATALOGS) as Catalog[]) {
    const source = (await readCatalog(catalog, 'fr')) ?? {};
    const own = await readCatalog(catalog, lang);
    const stamps = lock[lang]?.[catalog] ?? {};
    const s: CatalogStatus = { absent: own === null, missing: [], stale: [], unstamped: [], same: [] };
    for (const [key, french] of Object.entries(source)) {
      const text = own?.[key];
      if (text === undefined) {
        if (own) s.missing.push(key);
        continue;
      }
      const stamp = stamps[key];
      if (stamp === undefined) s.unstamped.push(key);
      else if (stamp !== fingerprint(french)) s.stale.push(key);
      if (text === french && french !== '' && !mayEqualFrench(lang, catalog, key)) s.same.push(key);
    }
    out[catalog] = s;
  }
  return out;
}

/**
 * Records that a language's keys are translated from today's French: every key its files hold (or only `keys`), and
 * forgets the keys French no longer has. Run after translating, never to silence a stale key without translating it.
 */
export async function stamp(lang: Lang, keys?: string[]): Promise<number> {
  if (lang === 'fr') throw new Error('French is the source: nothing to stamp');
  const lock = readLock();
  const entry = lock[lang] ?? {};
  lock[lang] = entry;
  let count = 0;
  for (const catalog of Object.keys(CATALOGS) as Catalog[]) {
    const source = (await readCatalog(catalog, 'fr')) ?? {};
    const own = await readCatalog(catalog, lang);
    if (!own) continue;
    const kept = entry[catalog] ?? {};
    const next: Record<string, string> = {};
    for (const [key, french] of Object.entries(source)) {
      if (own[key] === undefined) continue;
      const fresh = !keys || keys.includes(key);
      const value = fresh ? fingerprint(french) : kept[key];
      if (value !== undefined) next[key] = value;
      if (fresh) count++;
    }
    entry[catalog] = next;
  }
  const ordered = Object.fromEntries(
    LANGUAGES.map((l) => l.code)
      .filter((code) => lock[code])
      .map((code) => [code, lock[code]]),
  );
  writeFileSync(LOCK_FILE, `${JSON.stringify(ordered, null, 2)}\n`);
  return count;
}
