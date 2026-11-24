import {
  choiceFromRules,
  encodeRulesChoice,
  exportRulesJson,
  importRulesJson,
  PRESETS,
  type RuleSetInput,
  type RulesChoice,
  rulesOf,
} from '@tamalou/shared';
import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { trackEvent } from '../audience.ts';
import { plural, presetText, t } from '../i18n/index.ts';
import { FieldRow } from './FieldRow.tsx';
import { getAt, SECTIONS, setAt } from './fields.ts';
import { summarize } from './summary.ts';
import { TileArt } from './TileArt.tsx';

// The game master's screen (docs/SPEC.md §3), as the owner picked it on the 2026-11-24 canvas: the preset on top, then
// one illustrated tile per section saying tonight's rules in a line or two (summary.ts) and marked "modifié" when the
// game master changed it. On a phone the tiles are stacked and the one touched opens in place (H); on a wide screen
// they stay in a column and the chosen one opens large beside them (I). The editor holds full rules; what it hands back
// is a preset and the smallest set of changes from it.

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

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

/** The wide layout, from the width where a column of tiles and an open section fit side by side. */
const WIDE = '(min-width: 960px)';
const subscribeWide = (onChange: () => void) => {
  const media = globalThis.matchMedia?.(WIDE);
  media?.addEventListener('change', onChange);
  return () => media?.removeEventListener('change', onChange);
};
const isWide = () => globalThis.matchMedia?.(WIDE).matches ?? false;

interface Props {
  choice: RulesChoice;
  /** The mode's own defaults, under the game master's changes (rulesOf). */
  base?: RuleSetInput;
  onChange: (c: RulesChoice) => void;
  onDone: () => void;
}

export function RulesEditor({ choice, base = {}, onChange, onDone }: Props) {
  const rules = rulesOf(choice, base);
  const preset = rulesOf({ preset: choice.preset, overrides: {} }, base);
  const [status, setStatus] = useState('');
  const [opened, setOpened] = useState<string | null>(null);
  const wide = useSyncExternalStore(subscribeWide, isWide, () => false);
  // A wide screen always shows a section beside the tiles.
  const open = opened ?? (wide ? (SECTIONS[0]?.id ?? null) : null);
  const file = useRef<HTMLInputElement>(null);
  const tiles = useRef<HTMLDivElement>(null);

  // On a phone, the tile just opened comes to the top: the one above may have closed and moved it.
  useEffect(() => {
    if (wide || !opened) return;
    const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    tiles.current
      ?.querySelector(`[data-section="${opened}"]`)
      ?.scrollIntoView?.({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
  }, [opened, wide]);

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
      if (navigator.share) {
        await navigator.share({ title: t('appName'), url });
        trackEvent('rules-shared', { how: 'share' });
      } else {
        await navigator.clipboard.writeText(url);
        setStatus(t('editorCopied'));
        trackEvent('rules-shared', { how: 'copy' });
      }
    } catch {
      // Share sheet dismissed, or clipboard refused: nothing happened, nothing to say.
    }
  };

  const changes = countChanges(choice.overrides);
  const summary = summarize(rules);

  return (
    <main className={`editor${wide ? ' editor-wide' : ''}`}>
      <header className="editor-head">
        <h1>{t('editorTitle')}</h1>
        <button type="button" className="btn btn-primary" onClick={onDone}>
          {t('editorDone')}
        </button>
      </header>

      <fieldset className="editor-presets">
        <legend className="sr-only">{t('homePreset')}</legend>
        <div className="pills big">
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

      <div className="rule-tiles" ref={tiles}>
        {SECTIONS.map((section) => {
          const isOpen = open === section.id;
          const title = t(section.title);
          const lines = summary.find((s) => s.title === section.title)?.lines ?? [];
          const changed = section.fields.some((f) => !same(getAt(rules, f.path), getAt(preset, f.path)));
          const bodyId = `rules-${section.id}`;
          return (
            <Fragment key={section.id}>
              <button
                type="button"
                className={`rule-tile${isOpen ? ' open' : ''}`}
                data-section={section.id}
                aria-label={title}
                aria-describedby={`${bodyId}-sum`}
                aria-expanded={isOpen}
                aria-controls={isOpen ? bodyId : undefined}
                onClick={() => setOpened(isOpen && !wide ? null : section.id)}
              >
                <span className="rt-art" aria-hidden="true">
                  <TileArt section={section.id} rules={rules} />
                </span>
                <span className="rt-text">
                  <span className="rt-title">
                    {title}
                    {changed ? <span className="tag">{t('editorChanged')}</span> : null}
                  </span>
                  <span className="rt-sum" id={`${bodyId}-sum`}>
                    {lines.map((l) => (
                      <span key={l.text}>{l.text} </span>
                    ))}
                  </span>
                </span>
                <svg className="rt-chevron" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {isOpen ? (
                <section className="rule-body" id={bodyId} aria-label={title}>
                  {wide ? (
                    <div className="rule-hero" aria-hidden="true">
                      <TileArt section={section.id} rules={rules} />
                    </div>
                  ) : null}
                  {section.fields
                    .filter((f) => !f.when || f.when(rules))
                    .map((f) => (
                      <FieldRow key={f.id} field={f} rules={rules} preset={preset} update={update} />
                    ))}
                </section>
              ) : null}
            </Fragment>
          );
        })}
      </div>

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
