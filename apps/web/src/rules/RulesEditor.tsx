import {
  choiceFromRules,
  encodeRulesChoice,
  exportRulesJson,
  importRulesJson,
  POWERS,
  type Power,
  PRESETS,
  RANKS,
  type Rank,
  type RuleSet,
  type RuleSetInput,
  type RulesChoice,
  rulesOf,
  type Suit,
} from '@tamalou/shared';
import { type ReactNode, useRef, useState } from 'react';
import { type Key, plural, presetText, rankName, t } from '../i18n/index.ts';
import { displayNumber, type Field, getAt, SECTIONS, setAt } from './fields.ts';
import { RulesSummary } from './RulesSummary.tsx';

// The game master's screen (docs/SPEC.md §3): a preset, then every setting with its French help, a live summary, and
// the rules out and in as a JSON file or a link. The editor holds full rules; what it hands back is a preset and the
// smallest set of changes from it.

const SUIT_SETS: { id: string; suits: Suit[]; label: Key | null; symbol?: string }[] = [
  { id: 'all', suits: [], label: 'suitsAll' },
  { id: 'red', suits: ['H', 'D'], label: 'suitsRed' },
  { id: 'black', suits: ['S', 'C'], label: 'suitsBlack' },
  { id: 'S', suits: ['S'], label: null, symbol: '♠' },
  { id: 'H', suits: ['H'], label: null, symbol: '♥' },
  { id: 'D', suits: ['D'], label: null, symbol: '♦' },
  { id: 'C', suits: ['C'], label: null, symbol: '♣' },
];
const suitSetOf = (suits: Suit[]) =>
  SUIT_SETS.find((s) => JSON.stringify(s.suits) === JSON.stringify(suits))?.id ?? 'all';

const presetDescription = (id: string) => {
  const p = PRESETS.find((x) => x.id === id);
  return p ? presetText(p.id, p).description : '';
};

export function countChanges(overrides: object): number {
  return Object.values(overrides).reduce<number>(
    (n, v) => n + (v && typeof v === 'object' && !Array.isArray(v) ? countChanges(v) : 1),
    0,
  );
}

interface Props {
  choice: RulesChoice;
  /** The mode's own defaults, under the game master's changes (rulesOf). */
  base?: RuleSetInput;
  onChange: (c: RulesChoice) => void;
  onDone: () => void;
}

export function RulesEditor({ choice, base = {}, onChange, onDone }: Props) {
  const rules = rulesOf(choice, base);
  const [status, setStatus] = useState('');
  const file = useRef<HTMLInputElement>(null);

  const update = (path: readonly string[], value: unknown) => {
    const next = setAt(rules, path, value);
    if (next) onChange(choiceFromRules(choice.preset, next, base));
  };

  const exportFile = () => {
    const blob = new Blob([exportRulesJson(rules)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tamalou-regles.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importFile = async (f: File | undefined) => {
    if (!f) return;
    const res = importRulesJson(await f.text());
    if (!res.ok) {
      setStatus(t('editorImportError', { error: res.error }));
      return;
    }
    onChange(choiceFromRules(choice.preset, res.rules, base));
    setStatus(t('editorImported'));
  };

  const share = async () => {
    const url = `${location.origin}${location.pathname}#rules=${encodeRulesChoice(choice)}`;
    try {
      if (navigator.share) await navigator.share({ title: t('appName'), url });
      else {
        await navigator.clipboard.writeText(url);
        setStatus(t('editorCopied'));
      }
    } catch {
      // Share sheet dismissed, or clipboard refused: nothing happened, nothing to say.
    }
  };

  const changes = countChanges(choice.overrides);

  return (
    <main className="editor">
      <header className="editor-head">
        <h1>{t('editorTitle')}</h1>
        <button type="button" className="btn btn-primary" onClick={onDone}>
          {t('editorDone')}
        </button>
      </header>

      <fieldset className="field">
        <legend>{t('homePreset')}</legend>
        <div className="segmented" style={{ gridTemplateColumns: `repeat(${PRESETS.length}, 1fr)` }}>
          {PRESETS.map((p) => (
            <label key={p.id} className={choice.preset === p.id ? 'on' : ''}>
              <input
                type="radio"
                name="editor-preset"
                checked={choice.preset === p.id}
                onChange={() => onChange({ preset: p.id, overrides: {} })}
              />
              {presetText(p.id, p).name}
            </label>
          ))}
        </div>
        <p className="muted small">
          {changes > 0 ? plural('editorModified', changes) : presetDescription(choice.preset)}
          {changes > 0 ? (
            <button type="button" className="link" onClick={() => onChange({ preset: choice.preset, overrides: {} })}>
              {t('editorReset')}
            </button>
          ) : null}
        </p>
      </fieldset>

      {SECTIONS.map((section, i) => (
        <details key={section.id} className="rule-section" open={i === 0}>
          <summary>{t(section.title)}</summary>
          {section.fields
            .filter((f) => !f.when || f.when(rules))
            .map((f) => (
              <FieldRow key={f.id} field={f} rules={rules} update={update} />
            ))}
        </details>
      ))}

      <section className="editor-summary">
        <h2>{t('editorSummary')}</h2>
        <RulesSummary rules={rules} />
      </section>

      <div className="editor-actions">
        <button type="button" className="btn btn-secondary" onClick={share}>
          {t('editorShare')}
        </button>
        <button type="button" className="btn btn-secondary" onClick={exportFile}>
          {t('editorExport')}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => file.current?.click()}>
          {t('editorImport')}
        </button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            void importFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      <p className="status" role="status">
        {status}
      </p>
    </main>
  );
}

function FieldRow({
  field: f,
  rules,
  update,
}: {
  field: Field;
  rules: RuleSet;
  update: (path: readonly string[], value: unknown) => void;
}) {
  const label = t(`rule_${f.id}` as Key);
  const help = t(`rule_${f.id}_help` as Key);
  const id = `rule-${f.id}`;
  const value = getAt(rules, f.path);

  let control: ReactNode = null;
  switch (f.kind) {
    case 'toggle':
      control = (
        <button
          type="button"
          role="switch"
          id={id}
          aria-checked={value === true}
          aria-describedby={`${id}-help`}
          className="switch"
          onClick={() => update(f.path, !value)}
        >
          <span>{value ? t('yes') : t('no')}</span>
        </button>
      );
      break;
    case 'number': {
      const n = value as number;
      const unit = f.unit === 'points' ? t('unitPoints') : f.unit ? t('unitSeconds') : '';
      control = (
        <fieldset className="stepper small" aria-labelledby={`${id}-label`} aria-describedby={`${id}-help`}>
          <button
            type="button"
            aria-label={t('minus')}
            disabled={n <= f.min}
            onClick={() => update(f.path, Math.max(f.min, n - f.step))}
          >
            −
          </button>
          <output className="mono" aria-live="polite">
            {displayNumber(f, n)}
            {unit ? <small> {unit}</small> : null}
          </output>
          <button
            type="button"
            aria-label={t('plus')}
            disabled={n >= f.max}
            onClick={() => update(f.path, Math.min(f.max, n + f.step))}
          >
            +
          </button>
        </fieldset>
      );
      break;
    }
    case 'select':
      control = (
        <div className="segmented" role="radiogroup" aria-labelledby={`${id}-label`} aria-describedby={`${id}-help`}>
          {f.options.map((o) => (
            <label key={o.value} className={value === o.value ? 'on' : ''}>
              <input type="radio" name={id} checked={value === o.value} onChange={() => update(f.path, o.value)} />
              {t(o.label)}
            </label>
          ))}
        </div>
      );
      break;
    case 'rankValues':
      control = (
        <div className="rank-grid">
          {RANKS.filter((r) => r !== 'JOKER' || rules.deck.jokers).map((rank) => (
            <label key={rank}>
              <span>{rankName({ rank })}</span>
              <input
                type="number"
                inputMode="numeric"
                min={-50}
                max={50}
                value={rules.values.byRank[rank]}
                onChange={(e) => {
                  const v = Number.parseInt(e.target.value, 10);
                  if (Number.isFinite(v)) update([...f.path, rank], v);
                }}
              />
            </label>
          ))}
        </div>
      );
      break;
    case 'rankPowers':
      control = (
        <div className="rank-grid wide">
          {RANKS.filter((r) => r !== 'JOKER' || rules.deck.jokers).map((rank) => (
            <label key={rank}>
              <span>{rankName({ rank })}</span>
              <select
                value={rules.powers.byRank[rank]}
                onChange={(e) => update([...f.path, rank], e.target.value as Power)}
              >
                {POWERS.map((p) => (
                  <option key={p} value={p}>
                    {t(`power_${p}` as Key)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      );
      break;
    case 'overrides': {
      const list = rules.values.overrides;
      const set = (i: number, patch: Partial<(typeof list)[number]>) =>
        update(
          f.path,
          list.map((o, j) => (j === i ? { ...o, ...patch } : o)),
        );
      control = (
        <div className="overrides">
          {list.map((o, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows have no identity but their place
            <div key={i} className="override">
              <select
                aria-label={t('overrideRank')}
                value={o.rank}
                onChange={(e) => set(i, { rank: e.target.value as Rank })}
              >
                {RANKS.map((rank) => (
                  <option key={rank} value={rank}>
                    {rankName({ rank })}
                  </option>
                ))}
              </select>
              <select
                aria-label={t('overrideSuits')}
                value={suitSetOf(o.suits)}
                onChange={(e) => set(i, { suits: SUIT_SETS.find((s) => s.id === e.target.value)?.suits ?? [] })}
              >
                {SUIT_SETS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label ? t(s.label) : s.symbol}
                  </option>
                ))}
              </select>
              <input
                aria-label={t('overrideValue')}
                type="number"
                inputMode="numeric"
                min={-50}
                max={50}
                value={o.value}
                onChange={(e) => {
                  const v = Number.parseInt(e.target.value, 10);
                  if (Number.isFinite(v)) set(i, { value: v });
                }}
              />
              <button
                type="button"
                className="ghost"
                onClick={() =>
                  update(
                    f.path,
                    list.filter((_, j) => j !== i),
                  )
                }
              >
                {t('removeOverride')}
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => update(f.path, [...list, { rank: 'K', suits: ['H', 'D'], value: 0 }])}
          >
            {t('addOverride')}
          </button>
        </div>
      );
      break;
    }
    case 'peekSlots': {
      const slots = rules.hand.initialPeek.slots;
      control = (
        <div className="slot-picker" style={{ gridTemplateColumns: `repeat(${rules.hand.columns}, 44px)` }}>
          {Array.from({ length: rules.hand.size }, (_, s) => (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: a slot is its index
              key={s}
              type="button"
              aria-pressed={slots.includes(s)}
              aria-label={t('slotNumber', { n: s + 1 })}
              onClick={() =>
                update(f.path, slots.includes(s) ? slots.filter((x) => x !== s) : [...slots, s].sort((a, b) => a - b))
              }
            >
              {s + 1}
            </button>
          ))}
        </div>
      );
      break;
    }
  }

  return (
    <div className="rule-row">
      <div className="rule-text">
        {f.kind === 'toggle' ? (
          <label htmlFor={id} id={`${id}-label`}>
            {label}
          </label>
        ) : (
          <span id={`${id}-label`}>{label}</span>
        )}
        <small id={`${id}-help`}>{help}</small>
      </div>
      {control}
    </div>
  );
}
