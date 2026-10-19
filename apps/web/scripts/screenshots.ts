// Takes the manifest's screenshots (SCREENSHOTS in build/site.ts) of the real game, for the install dialog: run it,
// then commit the files in public/. Run it again after a visible change to what it shows, and rename the files when
// the pictures change: browsers cache them by URL. Like the icons, it needs a package that is not a dependency (CI
// would pay for a browser driver on every job); Chromium comes from Playwright's own folder or CHROMIUM_PATH:
//
//   npm i --no-save playwright-core && node apps/web/scripts/screenshots.ts
//
// It starts Vite's dev server and opens each view in Chromium: French, light theme, reduced motion, a fresh browser
// each time with three medium bots remembered, nothing loaded from other sites, and Math.random seeded, so the same
// deal shows from one run to the next.

import { resolve } from 'node:path';
import { chromium, type Page } from 'playwright-core';
import { createServer } from 'vite';
import { SCREEN_SIZES, SCREENSHOTS, type Screenshot } from '../build/site.ts';

/** Picked for the table it deals: a first turn where the player holds the deck's choice, nothing forced. */
const SEED = 11;
/** The remembered setup (HomeScreen.tsx's `tamalou-solo`): a full table of three bots. */
const SETUP = { mode: 'solo', name: '', players: ['', ''], bots: 3, level: 'medium', preset: 'classic', overrides: {} };

const web = resolve(import.meta.dirname, '..');
const server = await createServer({ root: web, logLevel: 'error', server: { strictPort: false } });
await server.listen();
const base = server.resolvedUrls?.local[0];
if (!base) throw new Error('the dev server has no local address');
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

const open = async (page: Page, view: Screenshot['view']) => {
  await page.goto(new URL('play/', base).href);
  await page.getByRole('button', { name: 'Jouer' }).waitFor();
  if (view === 'home') return;
  await page.getByRole('button', { name: 'Jouer' }).click();
  await page.getByRole('button', { name: 'C’est mémorisé' }).click();
  // The deal settles: the bots before me play on the real clock, then the bar offers me the draw, and the "À toi !"
  // greeting leaves the deck in view again.
  await page.getByRole('button', { name: 'Piocher' }).waitFor({ timeout: 15000 });
  await page
    .locator('.turn-banner')
    .waitFor({ state: 'hidden', timeout: 8000 })
    .catch(() => {});
  if (view === 'rules') {
    await page.getByRole('button', { name: 'Règles' }).click();
    await page.locator('.rc-slide').first().waitFor();
  }
};

try {
  for (const shot of SCREENSHOTS) {
    const size = SCREEN_SIZES[shot.form];
    const narrow = shot.form === 'narrow';
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: size.scale,
      isMobile: narrow,
      hasTouch: narrow,
      locale: 'fr-FR',
      colorScheme: 'light',
      reducedMotion: 'reduce',
    });
    await context.route(
      (url) => !url.href.startsWith(base),
      (route) => route.abort(),
    );
    await context.addInitScript(
      ({ seed, setup }: { seed: number; setup: typeof SETUP }) => {
        // mulberry32: the deal's seed is drawn from Math.random (connection/local.ts).
        let a = seed;
        Math.random = () => {
          a = (a + 0x6d2b79f5) | 0;
          let x = Math.imul(a ^ (a >>> 15), 1 | a);
          x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
          return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
        };
        localStorage.setItem('tamalou-solo', JSON.stringify(setup));
        localStorage.setItem('tamalou-lang', 'fr');
      },
      { seed: SEED, setup: SETUP },
    );
    const page = await context.newPage();
    await open(page, shot.view);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    const file = resolve(web, 'public', shot.file);
    await page.screenshot({ path: file });
    console.log(`${shot.file.padEnd(26)} ${size.width * size.scale}×${size.height * size.scale}  ${shot.view}`);
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}
