// `pnpm i18n:shots <code>` (ADR-0028, docs/plans/languages.md § 3.2): the game's screens in one language, at a phone's
// size and a computer's, light and dark, to look at before a translation ships. `xx-long` is the development
// pseudo-language (src/i18n/pseudo.ts): every text accented, 40 % longer, bracketed.
//
//   pnpm i18n:shots en          pictures in apps/web/shots/en/ (not committed), and a report
//
// Besides the pictures, it reports what a person would have to hunt for: a text wider than its box, a page wider
// than the screen, and in the pseudo-language a visible text without brackets, i.e. one that did not go through t().
// Like scripts/screenshots.ts it starts Vite's dev server and drives Chromium (Playwright's, found by `require`: the
// cloud container has it, elsewhere `npm i --no-save playwright-core`), with Math.random seeded so the deal repeats.

import { mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { isLang, language } from '@tamalou/shared/languages';
import { createServer } from 'vite';
import fr, { type Messages } from '../src/i18n/fr.ts';
import { pseudoMessages } from '../src/i18n/pseudo.ts';
import { PSEUDO } from '../src/i18n/remember.ts';

type PW = typeof import('playwright-core');
type Page = import('playwright-core').Page;

const code = process.argv[2] ?? '';
if (code !== PSEUDO && !isLang(code)) {
  console.error(`usage: pnpm i18n:shots <code>   (a language of packages/shared languages.ts, or ${PSEUDO})`);
  process.exit(2);
}

const web = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const load = (name: string): PW | null => {
  try {
    return require(name) as PW;
  } catch {
    return null;
  }
};
const pw = load('playwright-core') ?? load('playwright');
if (!pw) {
  console.error('Playwright is not installed: npm i --no-save playwright-core');
  process.exit(2);
}

const dict: Messages =
  code === PSEUDO ? pseudoMessages(fr) : ((await import(`../src/i18n/${code}.ts`)) as { default: Messages }).default;
const SETUP = { mode: 'solo', name: '', players: ['', ''], bots: 3, level: 'medium', preset: 'classic', overrides: {} };
const SEED = 11;
const FORMS = {
  phone: { width: 390, height: 844, mobile: true },
  computer: { width: 1280, height: 800, mobile: false },
} as const;
/** Visible words allowed without brackets in the pseudo-language: names, and `Intl`'s own words (a list's «et»). */
const ALLOWED = new Set([...fr.botNames.split(','), 'Tamalou', 'et']);

const out = resolve(web, 'shots', code);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const server = await createServer({ root: web, logLevel: 'error', server: { strictPort: false } });
await server.listen();
const base = server.resolvedUrls?.local[0];
if (!base) throw new Error('the dev server has no local address');
const browser = await pw.chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

/** What is wrong on screen: overflowing boxes, a page wider than the window, unbracketed text in the pseudo-language. */
async function inspect(page: Page, pseudo: boolean): Promise<string[]> {
  return page.evaluate(
    ({ pseudo, allowed }) => {
      const found: string[] = [];
      const name = (el: Element) =>
        `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).join('.')}` : ''}`;
      const doc = document.documentElement;
      if (doc.scrollWidth > innerWidth + 1) found.push(`page ${doc.scrollWidth}px wide in a ${innerWidth}px window`);
      for (const el of document.querySelectorAll<HTMLElement>('body *')) {
        if (!el.checkVisibility?.() || el.closest('svg, .card')) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'inline' || cs.display === 'contents') continue;
        const scrolls = /auto|scroll/.test(cs.overflowX);
        const text = (el.textContent ?? '').trim();
        if (!scrolls && text && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
          const own = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
          if (own) found.push(`overflow ${name(el)} (${el.scrollWidth}>${el.clientWidth}): ${text.slice(0, 50)}`);
        }
      }
      // A text wider than the button, link, label or cell it sits in: overflowing, or cut by an ellipsis.
      const range = document.createRange();
      const texts = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = texts.nextNode(); n; n = texts.nextNode()) {
        const el = n.parentElement;
        const box = el?.closest<HTMLElement>('button, a, label, li, td, th, summary');
        if (!el || !box || !n.textContent?.trim() || !el.checkVisibility?.() || el.closest('svg, .card')) continue;
        range.selectNodeContents(n);
        const r = range.getBoundingClientRect();
        const b = box.getBoundingClientRect();
        if (r.width && (r.right > b.right + 1 || r.left < b.left - 1))
          found.push(`cut or overflowing ${name(box)}: ${n.textContent.trim().slice(0, 50)}`);
      }
      if (pseudo) {
        const suspect = (s: string) =>
          s
            .split(/[^A-Za-z]+/)
            .filter((w) => w.length > 1 && !allowed.includes(w))
            .join(' ');
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const el = n.parentElement;
          // A word in its own language (a language list's «English») is meant to stay as it is.
          const own = el?.closest('[lang]');
          if (!el?.checkVisibility?.() || el.closest('svg, script, style, .version')) continue;
          if (own && own !== document.documentElement) continue;
          const words = suspect(n.textContent ?? '');
          if (words) found.push(`text not translated: «${(n.textContent ?? '').trim().slice(0, 60)}»`);
        }
        for (const el of document.querySelectorAll<HTMLElement>('[aria-label], [placeholder], [title]')) {
          for (const attr of ['aria-label', 'placeholder', 'title']) {
            const v = el.getAttribute(attr);
            if (v && suspect(v)) found.push(`${attr} not translated: «${v.slice(0, 60)}»`);
          }
        }
      }
      return [...new Set(found)];
    },
    { pseudo, allowed: [...ALLOWED] },
  );
}

const button = (page: Page, key: keyof Messages) => page.getByRole('button', { name: dict[key], exact: true }).first();

/** The screens, in the order a player meets them; each step leaves the page on the next one. */
const SCREENS: Array<[string, (page: Page) => Promise<void>]> = [
  ['home', async (page) => void (await page.locator('.mode-tile').first().waitFor())],
  ['settings', async (page) => void (await page.getByRole('button', { name: dict.settings }).click())],
  [
    'setup',
    async (page) => {
      await button(page, 'close').click();
      await page.locator('.mode-tile.mode-solo').click();
      await page.locator('.sheet, .setup').first().waitFor();
    },
  ],
  [
    'peek',
    async (page) => {
      await button(page, 'homePlay').click();
      await button(page, 'actReady').waitFor({ timeout: 15000 });
    },
  ],
  [
    'table',
    async (page) => {
      await button(page, 'actReady').click();
      await page.getByRole('button', { name: dict.actDrawDeck }).first().waitFor({ timeout: 20000 });
      await page
        .locator('.turn-banner')
        .waitFor({ state: 'hidden', timeout: 8000 })
        .catch(() => {});
    },
  ],
  ['journal', async (page) => void (await page.getByRole('button', { name: dict.journal }).first().click())],
  [
    'menu',
    async (page) => {
      await page.getByRole('button', { name: dict.journal }).first().click();
      await page.getByRole('button', { name: dict.moreOptions }).click();
    },
  ],
  [
    'rules',
    async (page) => {
      await page.getByRole('menuitem', { name: dict.rules }).click();
      await page.locator('.rc-slide').first().waitFor();
    },
  ],
  [
    'round-over',
    async (page) => {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      await page.getByRole('button', { name: dict.actCall, exact: true }).click({ timeout: 5000 });
      await page.locator('.overlay-round').waitFor({ timeout: 60000 });
    },
  ],
];

const report: string[] = [];
try {
  for (const [formName, form] of Object.entries(FORMS)) {
    for (const theme of ['light', 'dark'] as const) {
      const context = await browser.newContext({
        viewport: { width: form.width, height: form.height },
        deviceScaleFactor: 1,
        isMobile: form.mobile,
        hasTouch: form.mobile,
        locale: code === PSEUDO ? 'fr-FR' : language(code).locale,
        colorScheme: theme,
        reducedMotion: 'reduce',
      });
      // Nothing from other sites, and no rooms server: the solo game needs none.
      await context.route(
        (url) => !url.href.startsWith(base) || url.pathname.startsWith('/api/'),
        (route) => route.abort(),
      );
      await context.addInitScript(
        ({ seed, setup }: { seed: number; setup: typeof SETUP }) => {
          let a = seed;
          Math.random = () => {
            a = (a + 0x6d2b79f5) | 0;
            let x = Math.imul(a ^ (a >>> 15), 1 | a);
            x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
            return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
          };
          localStorage.setItem('tamalou-solo', JSON.stringify(setup));
        },
        { seed: SEED, setup: SETUP },
      );
      const page = await context.newPage();
      await page.goto(new URL(`play/?lang=${code}`, base).href);
      for (const [screen, go] of SCREENS) {
        try {
          await go(page);
        } catch (e) {
          report.push(`${formName} ${theme} ${screen}: not reached (${(e as Error).message.split('\n')[0]})`);
          break;
        }
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(500);
        await page.screenshot({ path: resolve(out, `${screen}-${formName}-${theme}.png`) });
        if (theme === 'light')
          for (const issue of await inspect(page, code === PSEUDO)) report.push(`${formName} ${screen}: ${issue}`);
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}

console.log(`pictures in ${out}`);
console.log(report.length ? [...new Set(report)].join('\n') : 'nothing overflows, nothing left untranslated');
process.exit(report.some((r) => !r.includes('not reached')) ? 1 : 0);
