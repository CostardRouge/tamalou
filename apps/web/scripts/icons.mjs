// Draws the PNG icons from the three SVG sources in public/ (COMMON-PROJECT-SPEC C11). Run by hand after changing a
// source, and commit the PNGs: a static host cannot rasterise on request. sharp is not a dependency (CI would pay a
// native install on every job):
//
//   npm i --no-save sharp && node apps/web/scripts/icons.mjs
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
