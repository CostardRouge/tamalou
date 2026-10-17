import { parseRules, type RuleSet, type RuleSetInput } from './rules.ts';

// A preset is a partial RuleSet: only what it changes from the defaults ("Classique" changes nothing).

export interface Preset {
  id: string;
  /** French, shown in the lobby. */
  name: string;
  description: string;
  rules: RuleSetInput;
}

export const PRESETS: readonly Preset[] = [
  {
    id: 'classic',
    name: 'Classique',
    description: 'Les règles de la maison : 4 cartes, éliminé à 100, +10 pour un Tamalou raté.',
    rules: {},
  },
  {
    id: 'quick',
    name: 'Rapide',
    description: 'Une partie courte : éliminé à 50, et la partie s’arrête au premier éliminé.',
    rules: { gameEnd: { threshold: 50, thresholdEnd: 'firstElimination' } },
  },
  {
    id: 'beginner',
    name: 'Débutant',
    description: 'Les cartes déjà vues restent affichées : pour apprendre sans travailler sa mémoire.',
    rules: { assist: { showKnownCards: true } },
  },
];

type Plain = Record<string, unknown>;
const isPlain = (v: unknown): v is Plain => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Deep merge of partial rule objects; arrays and scalars from later layers replace earlier ones. */
export function mergeRuleInputs(...layers: RuleSetInput[]): RuleSetInput {
  const merge = (a: Plain, b: Plain): Plain => {
    const out: Plain = { ...a };
    for (const [k, v] of Object.entries(b)) {
      if (v === undefined) continue;
      const prev = out[k];
      out[k] = isPlain(prev) && isPlain(v) ? merge(prev, v) : v;
    }
    return out;
  };
  return layers.reduce<Plain>((acc, layer) => merge(acc, layer as Plain), {}) as RuleSetInput;
}

/** A preset's full rules, with the game master's own changes on top. */
export function rulesFromPreset(presetId: string, overrides: RuleSetInput = {}): RuleSet {
  const preset = PRESETS.find((p) => p.id === presetId);
  if (!preset) throw new Error(`unknown preset ${presetId}`);
  return parseRules(mergeRuleInputs(preset.rules, overrides));
}
