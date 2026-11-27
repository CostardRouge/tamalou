// The translations' commands (ADR-0028, docs/plans/languages.md § 3.2), from the repository's root:
//
//   pnpm i18n:status [code…]   what each language lacks: missing, stale (French changed since), unstamped, same as French
//   pnpm i18n:stamp <code>     records that the language's keys are translated from today's French (lock.json)
//   pnpm i18n:shots <code>     screenshots of the game's screens in that language (scripts/shots.ts)
//
// `status` exits 1 when a language with files is behind, as the tests do.

import { isLang, LANGUAGES, type Lang } from '@tamalou/shared/languages';
import { CATALOGS, type Catalog, type CatalogStatus, stamp, status } from '../build/i18n.ts';

const [command, ...args] = process.argv.slice(2);

const list = (title: string, keys: string[]) =>
  keys.length ? `    ${title} (${keys.length}): ${keys.slice(0, 12).join(', ')}${keys.length > 12 ? ', …' : ''}` : null;

async function showStatus(codes: Lang[]): Promise<boolean> {
  let behind = false;
  for (const lang of codes) {
    if (lang === 'fr') continue;
    const s = await status(lang);
    const ready = LANGUAGES.find((l) => l.code === lang)?.ready ? 'ready' : 'not ready';
    const lines: string[] = [];
    for (const catalog of Object.keys(CATALOGS) as Catalog[]) {
      const c: CatalogStatus = s[catalog];
      if (c.absent) {
        lines.push(`  ${catalog}: no file (${CATALOGS[catalog]}/${lang}.ts)`);
        continue;
      }
      const detail = [
        list('missing', c.missing),
        list('stale', c.stale),
        list('unstamped', c.unstamped),
        list('same as French', c.same),
      ].filter(Boolean);
      if (detail.length) behind = true;
      lines.push(detail.length ? `  ${catalog}:\n${detail.join('\n')}` : `  ${catalog}: up to date`);
    }
    console.log(`${lang} (${ready})\n${lines.join('\n')}`);
  }
  return !behind;
}

if (command === 'status') {
  const codes = args.length ? args.filter(isLang) : LANGUAGES.map((l) => l.code);
  process.exit((await showStatus(codes)) ? 0 : 1);
} else if (command === 'stamp') {
  const [code, ...keys] = args;
  if (!isLang(code) || code === 'fr') {
    console.error('usage: pnpm i18n:stamp <code> [key…]   (a language other than fr)');
    process.exit(2);
  }
  const count = await stamp(code, keys.length ? keys : undefined);
  console.log(`${code}: ${count} keys stamped in apps/web/src/i18n/lock.json`);
} else {
  console.error('usage: node apps/web/scripts/i18n.ts status [code…] | stamp <code> [key…]');
  process.exit(2);
}
