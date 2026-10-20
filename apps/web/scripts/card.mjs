// Draws the social cards into public/ (COMMON-PROJECT-SPEC C17: a 1200×630 OpenGraph card per language, not the
// icon): the icon's two cards, the site's name and copy (OG_IMAGES and CARD_COPY in build/site.ts) in the light theme's
// tokens (COLORS) and the fonts the site ships. Run by hand after changing the copy, the mark, the colours or the fonts,
// then commit the PNGs, and rename them in OG_IMAGES when the drawing changes: unfurlers cache a card by its URL.
//
// Text is set by pango through sharp from the very WOFF2 files @fontsource-variable installs for the site; sharp's
// libvips reads TTF but not WOFF2, so wawoff2 (Google's decoder) unpacks them into a temporary folder first. Neither
// is a dependency (CI would pay a native install on every job), and npm cannot install into this pnpm workspace (it
// crashes on pnpm's links, or would rewrite node_modules in its own layout): install them beside it and link them in.
//
//   npm i --prefix /tmp/card sharp wawoff2 && ln -s /tmp/card/node_modules/sharp /tmp/card/node_modules/wawoff2 node_modules/
//   node apps/web/scripts/card.mjs && rm node_modules/sharp node_modules/wawoff2

import { Buffer } from 'node:buffer';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import woff2 from 'wawoff2';
import { CARD_COPY, COLORS, OG_IMAGES } from '../build/site.ts';

const require = createRequire(import.meta.url);
const pub = resolve(import.meta.dirname, '../public');
const tmp = await mkdtemp(join(tmpdir(), 'tamalou-card-'));

/**
 * The site's own font files, unpacked for pango. fontconfig names these fontsource builds after their default
 * instance ("Bricolage Grotesque 96pt ExtraBold", "Figtree Light") and offers the weights as styles: the markup below
 * names that family and asks for a weight, so a wrong family would fall back to the system's sans — check the PNG.
 */
async function font(pkg, file, family) {
  const path = join(tmp, `${pkg.split('/').pop()}.ttf`);
  await writeFile(path, Buffer.from(await woff2.decompress(await readFile(require.resolve(`${pkg}/files/${file}`)))));
  return { path, family };
}
const DISPLAY = await font(
  '@fontsource-variable/bricolage-grotesque',
  'bricolage-grotesque-latin-wght-normal.woff2',
  'Bricolage Grotesque 96pt ExtraBold',
);
const BODY = await font('@fontsource-variable/figtree', 'figtree-latin-wght-normal.woff2', 'Figtree Light');

const escaped = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A block of text as an RGBA layer: pango markup, one font, wrapped at `width` when given. */
async function text(s, { font, weight, size, color, width = 0, lineHeight = 1.2, letterSpacing = 0 }) {
  const markup = `<span font_family="${font.family}" weight="${weight}" size="${size * 1024}" foreground="${color}" line_height="${lineHeight}" letter_spacing="${Math.round(letterSpacing * 1024)}">${escaped(s)}</span>`;
  // sharp refuses a width of 0: a block that does not wrap leaves it out.
  const wrap = width ? { width, wrap: 'word' } : {};
  const png = await sharp({ text: { text: markup, fontfile: font.path, rgba: true, dpi: 72, ...wrap } })
    .png()
    .toBuffer();
  const { width: w, height: h } = await sharp(png).metadata();
  return { input: png, width: w, height: h };
}

const svg = (markup) => sharp(Buffer.from(markup)).png().toBuffer();

/** The icon's two cards on the page's background: the cobalt back behind the face with the coral T, with a shadow. */
const cards = (width, height) =>
  svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="92 52 336 408" width="${width}" height="${height}">
  <defs><filter id="s" x="-25%" y="-25%" width="150%" height="160%"><feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="${COLORS.ink}" flood-opacity="0.22"/></filter></defs>
  <g transform="rotate(-12 256 256)" filter="url(#s)">
    <rect x="150" y="104" width="196" height="276" rx="28" fill="${COLORS.a}"/>
    <rect x="166" y="120" width="164" height="244" rx="18" fill="none" stroke="${COLORS.cardBackInk}" stroke-width="5" opacity="0.6"/>
  </g>
  <g transform="rotate(8 256 256)" filter="url(#s)">
    <rect x="166" y="120" width="212" height="296" rx="30" fill="${COLORS.cardFace}" stroke="${COLORS.cardEdge}" stroke-width="3"/>
    <rect x="206" y="178" width="132" height="40" rx="8" fill="${COLORS.b}"/>
    <rect x="252" y="178" width="40" height="178" rx="8" fill="${COLORS.b}"/>
  </g>
</svg>`);

/** A right arrow, drawn: the fonts' latin subset has no U+2192. */
const arrow = (size, color) =>
  svg(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}"><path d="M4 12h15M13 5l7 7-7 7" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  );

const pill = (width, height, color) =>
  svg(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${height / 2}" fill="${color}"/></svg>`,
  );

async function card(lang) {
  const { width, height, path } = OG_IMAGES[lang];
  const copy = CARD_COPY[lang];
  const left = 72;
  const layers = [];
  const put = (layer, x, y) => layers.push({ input: layer.input ?? layer, left: Math.round(x), top: Math.round(y) });

  // The brand: the icon itself and the name, as the pages' header.
  const mark = await sharp(await readFile(resolve(pub, 'icon.svg')), { density: 300 })
    .resize(60, 60)
    .png()
    .toBuffer();
  put(mark, left, 60);
  const name = await text('Tamalou', { font: DISPLAY, weight: 800, size: 40, color: COLORS.ink, letterSpacing: -1 });
  put(name, left + 60 + 18, 60 + (60 - name.height) / 2);

  // Three short lines in the display face, then the sentence in the body face.
  const title = await text(copy.lines.join('\n'), {
    font: DISPLAY,
    weight: 800,
    size: 72,
    color: COLORS.ink,
    lineHeight: 1,
    letterSpacing: -2.5,
  });
  put(title, left - 4, 158);
  const body = await text(copy.body, {
    font: BODY,
    weight: 500,
    size: 27,
    color: COLORS.muted,
    width: 600,
    lineHeight: 1.3,
  });
  put(body, left, 158 + title.height + 26);

  // The button, as the home page's: ink on the page, the words in the page's own colour, and a note beside it.
  const cta = await text(copy.cta, { font: BODY, weight: 700, size: 26, color: COLORS.bg });
  const pad = 28;
  const arrowSize = 24;
  const pillW = pad + cta.width + 12 + arrowSize + pad;
  const pillH = 62;
  const pillY = 630 - 64 - pillH;
  put(await pill(pillW, pillH, COLORS.ink), left, pillY);
  put(cta, left + pad, pillY + (pillH - cta.height) / 2);
  put(await arrow(arrowSize, COLORS.bg), left + pad + cta.width + 12, pillY + (pillH - arrowSize) / 2);
  const note = await text(copy.note, { font: BODY, weight: 500, size: 23, color: COLORS.muted });
  put(note, left + pillW + 22, pillY + (pillH - note.height) / 2);

  // The two cards, on the right, as big as the page allows.
  const cardsH = 540;
  const cardsW = Math.round((cardsH * 336) / 408);
  put(await cards(cardsW, cardsH), width - cardsW - 48, (height - cardsH) / 2);

  const png = await sharp({ create: { width, height, channels: 3, background: COLORS.bg } })
    .composite(layers)
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(resolve(pub, path), png);
  console.log(`${path.padEnd(12)} ${width}×${height}  ${png.length} B`);
}

for (const lang of Object.keys(OG_IMAGES)) await card(lang);
await rm(tmp, { recursive: true, force: true });
