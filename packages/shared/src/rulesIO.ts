import { mergeRuleInputs, PRESETS, rulesFromPreset } from './presets.ts';
import type { RuleSet, RuleSetInput } from './rules.ts';
import { safeParseRules } from './rules.ts';

// Moving a RuleSet around (docs/SPEC.md §3): the game master's changes as the smallest diff from a preset, the JSON a
// player exports and imports, and the link that carries a table's rules. Everything coming in is validated by the
// schema; nothing is trusted because it parsed as JSON.

type Plain = Record<string, unknown>;
const isPlain = (v: unknown): v is Plain => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The fields of `rules` that differ from `base`, as a partial input: `mergeRuleInputs(base, diff)` gives `rules`. */
export function diffRuleInputs(rules: RuleSet | RuleSetInput, base: RuleSet | RuleSetInput): RuleSetInput {
  const diff = (a: Plain, b: Plain): Plain => {
    const out: Plain = {};
    for (const [k, v] of Object.entries(a)) {
      const w = b[k];
      if (isPlain(v) && isPlain(w)) {
        const d = diff(v, w);
        if (Object.keys(d).length > 0) out[k] = d;
      } else if (JSON.stringify(v) !== JSON.stringify(w)) {
        out[k] = v;
      }
    }
    return out;
  };
  return diff(rules as Plain, base as Plain) as RuleSetInput;
}

/** What a table's rules are made of: a preset and the game master's changes on top. */
export interface RulesChoice {
  preset: string;
  overrides: RuleSetInput;
}

/**
 * The rules of a choice. `base` is a layer between the preset and the changes: a mode's own defaults (pass-and-play
 * switches the quick discard off), so the game master's changes are measured against what the mode starts from.
 */
export function rulesOf(choice: RulesChoice, base: RuleSetInput = {}): RuleSet {
  return rulesFromPreset(choice.preset, mergeRuleInputs(base, choice.overrides));
}

/** Rebuilds a choice from full rules: the overrides become the smallest diff from the preset (and the base). */
export function choiceFromRules(preset: string, rules: RuleSet, base: RuleSetInput = {}): RulesChoice {
  return { preset, overrides: diffRuleInputs(rules, rulesFromPreset(preset, base)) };
}

// ---------------------------------------------------------------- JSON file

/** Tags an exported file. Not `tamalou`: that key is the RuleSet's own section about the call. */
const FORMAT = 'tamalou-rules';

/** The exported file: the full rules, readable, so a person can open it and see every value. */
export function exportRulesJson(rules: RuleSet): string {
  return `${JSON.stringify({ format: FORMAT, ...rules }, null, 2)}\n`;
}

export type ImportResult = { ok: true; rules: RuleSet } | { ok: false; error: string };

/** Reads an exported file, or any partial rules object: missing fields take their defaults. */
export function importRulesJson(text: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'json' };
  }
  if (!isPlain(data)) return { ok: false, error: 'shape' };
  const { format: _format, ...rest } = data;
  const parsed = safeParseRules(rest);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.path.join('.') || 'invalid' };
  return { ok: true, rules: parsed.data };
}

// ---------------------------------------------------------------- link

const toBase64Url = (text: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const fromBase64Url = (code: string) => {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

/** A short code for a link (`#rules=<code>`): the preset id and only the changed fields. */
export function encodeRulesChoice(choice: RulesChoice): string {
  return toBase64Url(JSON.stringify({ p: choice.preset, o: choice.overrides }));
}

/** The choice a link carries, or null when it is not one we can play (unknown preset, invalid rules, garbage). */
export function decodeRulesChoice(code: string): RulesChoice | null {
  try {
    const data = JSON.parse(fromBase64Url(code)) as unknown;
    if (!isPlain(data)) return null;
    return checkRulesChoice({ preset: data.p, overrides: data.o });
  } catch {
    return null;
  }
}

/**
 * A choice received from elsewhere (a link, a socket), checked: a known preset and changes that make valid rules. The
 * overrides come back as the smallest diff, so nothing unknown travels further. Null when it is not playable.
 */
export function checkRulesChoice(input: unknown): RulesChoice | null {
  if (!isPlain(input) || typeof input.preset !== 'string' || !isPlain(input.overrides)) return null;
  const preset = PRESETS.find((p) => p.id === input.preset);
  if (!preset) return null;
  const parsed = safeParseRules(mergeRuleInputs(preset.rules, input.overrides as RuleSetInput));
  if (!parsed.success) return null;
  return choiceFromRules(preset.id, parsed.data);
}
