// Draws the PNG icons from the three SVG sources in public/ (COMMON-PROJECT-SPEC C11). Run by hand after changing a
// source, and commit the PNGs: a static host cannot rasterise on request. sharp is not a dependency (CI would pay a
// native install on every job), and npm cannot install into this pnpm workspace (it crashes on pnpm's links, or
// would rewrite node_modules in its own layout): install it beside the workspace and link it in for the run, as
// scripts/card.mjs does.
//
//   npm i --prefix /tmp/card sharp && ln -s /tmp/card/node_modules/sharp node_modules/
//   node apps/web/scripts/icons.mjs && rm node_modules/sharp
//
// The touch icon is flattened onto the background colour: iOS shows transparency as black.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const pub = resolve(import.meta.dirname, '../public');
const src = async (name) => readFile(resolve(pub, name));

const jobs = [
  ['icon.svg', 'favicon-16.png', 16],
  ['icon.svg', 'favicon-32.png', 32],
  ['icon.svg', 'icon-192.png', 192],
  ['icon.svg', 'icon-512.png', 512],
  ['icon-maskable.svg', 'icon-maskable-192.png', 192],
  ['icon-maskable.svg', 'icon-maskable-512.png', 512],
  // The manifest's shortcuts (SHORTCUTS and SHORTCUT_SIZES in build/site.ts): a long press on the installed icon.
  ['shortcut-solo.svg', 'shortcut-solo-96.png', 96],
  ['shortcut-solo.svg', 'shortcut-solo-192.png', 192],
  ['shortcut-pass.svg', 'shortcut-pass-96.png', 96],
  ['shortcut-pass.svg', 'shortcut-pass-192.png', 192],
];
for (const [from, to, size] of jobs) {
  await sharp(await src(from), { density: 384 })
    .resize(size, size)
    .png()
    .toFile(resolve(pub, to));
}
await sharp(await src('icon-apple.svg'), { density: 384 })
  .resize(180, 180)
  .flatten({ background: '#2743f5' })
  .removeAlpha()
  .png()
  .toFile(resolve(pub, 'apple-touch-icon.png'));
console.log('icons written to', pub);
