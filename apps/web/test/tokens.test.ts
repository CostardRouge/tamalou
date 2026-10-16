import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The design tokens keep Versus's contrast promises in both themes (WCAG 1.4.3 and 1.4.11), and the card inks stay
// readable on the card face, which is light in both themes.

const css = readFileSync(resolve(import.meta.dirname, '../src/styles/tokens.css'), 'utf8');

function block(head: string): Record<string, string> {
  const start = css.indexOf(head);
  if (start < 0) throw new Error(`missing ${head}`);
  const body = css.slice(start + head.length, css.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{3,6})\s*;/gi)].map((m) => [m[1], m[2]]));
}

const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((x) => x + x).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => channel(Number.parseInt(full.slice(i, i + 2), 16)));
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
};

const THEMES = { light: block(':root {'), dark: block(':root[data-theme="dark"] {') };
const SURFACES = ['bg', 'surface', 'surface-2'];
const TEXT: [string, string[]][] = [
  ['ink', SURFACES],
  ['muted', SURFACES],
  ['a', SURFACES],
  ['b-ink', SURFACES],
  ['good-ink', SURFACES],
  ['bad', ['bg', 'surface']],
  ['on-accent', ['a', 'b-ink', 'bad']],
  ['card-ink', ['card-face']],
  ['card-red', ['card-face']],
  ['card-back-ink', ['card-back']],
];
const UI: [string, string[]][] = [
  ['field', SURFACES],
  ['a', SURFACES],
  ['b', ['bg', 'surface']],
  ['good', ['bg', 'surface']],
];

describe('design tokens', () => {
  it('defines the same tokens in the system dark theme as in the dark theme picked by hand', () => {
    expect(block(':root:not([data-theme="light"]) {')).toEqual(THEMES.dark);
    expect(Object.keys(THEMES.dark).sort()).toEqual(Object.keys(THEMES.light).sort());
  });

  for (const [name, theme] of Object.entries(THEMES)) {
    const ratio = (fg: string, bg: string) => {
      const a = theme[fg];
      const b = theme[bg];
      if (!a || !b) throw new Error(`missing --${a ? bg : fg}`);
      return contrast(a, b);
    };
    it(`keeps text at 4.5:1 in the ${name} theme`, () => {
      for (const [fg, bgs] of TEXT)
        for (const bg of bgs) expect(ratio(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    });
    it(`keeps fields and accents at 3:1 in the ${name} theme`, () => {
      for (const [fg, bgs] of UI)
        for (const bg of bgs) expect(ratio(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(3);
    });
  }
});
