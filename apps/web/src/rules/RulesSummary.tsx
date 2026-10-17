import type { RuleSet } from '@tamalou/shared';
import { t } from '../i18n/index.ts';
import { RulesCards } from './RulesCards.tsx';
import { summarize } from './summary.ts';

/** The active rules in plain French; a line that differs from Classique carries a "modifié" mark. */
export function RulesSummary({ rules }: { rules: RuleSet }) {
  return (
    <div className="summary">
      {summarize(rules).map((section) => (
        <section key={section.title}>
          <h3>{t(section.title)}</h3>
          <ul>
            {section.lines.map((l) => (
              <li key={l.text} className={l.changed ? 'changed' : undefined}>
                {l.text}
                {l.changed ? <span className="tag">{t('editorChanged')}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** The rules during a game, as cards to leaf through: every player can read them (docs/SPEC.md §3). */
export function RulesPanel({ rules, onClose }: { rules: RuleSet; onClose: () => void }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="rules-title">
      <div className="panel rc-panel">
        <div className="panel-head">
          <h2 id="rules-title">{t('editorTitle')}</h2>
          <button type="button" className="ghost" onClick={onClose} ref={(el) => el?.focus()}>
            {t('close')}
          </button>
        </div>
        <RulesCards rules={rules} />
      </div>
    </div>
  );
}
