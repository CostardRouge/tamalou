import type { RuleSet } from '@tamalou/shared';
import { useSettings } from '../feedback/settings.ts';
import { Overlay } from '../game/Overlay.tsx';
import { t } from '../i18n/index.ts';
import { RulesCards } from './RulesCards.tsx';
import { summarize } from './summary.ts';

/** The active rules in plain French; a line that differs from Classique carries a "modifié" mark. */
export function RulesSummary({ rules }: { rules: RuleSet }) {
  // The initial peek's sentence follows this device's hand layout (summary.ts): drawn again when it changes.
  useSettings();
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
    <Overlay labelledBy="rules-title" onClose={onClose}>
      <div className="panel rc-panel">
        <div className="panel-head">
          <h2 id="rules-title">{t('editorTitle')}</h2>
          <button type="button" className="ghost" onClick={onClose} ref={(el) => el?.focus()}>
            {t('close')}
          </button>
        </div>
        <RulesCards rules={rules} />
      </div>
    </Overlay>
  );
}
