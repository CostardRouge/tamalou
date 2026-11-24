import type { Avatar as AvatarValue, PlayerId } from '@tamalou/shared';
import { useState } from 'react';
import { CardView } from '../cards/CardView.tsx';
import { cardName, t } from '../i18n/index.ts';
import { Avatar } from '../profile/Avatar.tsx';
import { Icon } from './ActionBar.tsx';
import type { JournalItem, JournalMark } from './journal.ts';

// The journal during a game (the owner's picks on the 2026-11-24 canvas, ADR-0026): on a computer a panel at the
// right that pushes the table aside (A, `.game.journal-open` in app.css), on a phone a sheet over my hand, half the
// screen or almost all of it (C). Newest first, one block per player's go with the card it threw.

const MARK_ICON: Record<JournalMark, Parameters<typeof Icon>[0]['name']> = {
  look: 'look',
  swap: 'swap',
  quick: 'quick',
  call: 'call',
};

interface Props {
  items: JournalItem[];
  mode: 'full' | 'recent';
  nameOf: (id: PlayerId) => string;
  faceOf: (id: PlayerId) => AvatarValue;
  onClose: () => void;
}

export function Journal({ items, mode, nameOf, faceOf, onClose }: Props) {
  const [tall, setTall] = useState(false);
  const newest = [...items].reverse();
  const latest = newest.find((i) => i.kind === 'turn');
  return (
    <aside className={`journal${tall ? ' journal-tall' : ''}`} aria-label={t('journal')}>
      <button
        type="button"
        className="journal-handle"
        aria-label={t(tall ? 'journalShrink' : 'journalGrow')}
        onClick={() => setTall((v) => !v)}
      >
        <span />
      </button>
      <div className="journal-head">
        <div>
          <h2>{t('journal')}</h2>
          <p>{t(mode === 'full' ? 'journalFull' : 'journalRecent')}</p>
        </div>
        <button type="button" className="journal-close" aria-label={t('journalClose')} onClick={onClose}>
          <Icon name="cancel" />
        </button>
      </div>
      {newest.length === 0 ? (
        <p className="journal-empty">{t('journalEmpty')}</p>
      ) : (
        <ol>
          {newest.map((item) =>
            item.kind === 'note' ? (
              <li key={item.key} className={`journal-note${item.round ? ' journal-round' : ''}`}>
                {item.text}
              </li>
            ) : (
              <li key={item.key} className={`journal-turn${item === latest ? ' journal-latest' : ''}`}>
                <Avatar avatar={faceOf(item.player)} size="xs" />
                <div className="journal-lines">
                  <b>{nameOf(item.player)}</b>
                  {item.lines.map((l, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: a go's lines only grow
                    <span key={i} className={l.aboutMe ? 'about-me' : undefined}>
                      {l.mark ? <Icon name={MARK_ICON[l.mark]} /> : null}
                      {l.text}
                    </span>
                  ))}
                </div>
                {item.card ? (
                  <span className="journal-card">
                    <CardView card={item.card} label={cardName(item.card)} size="sm" />
                  </span>
                ) : null}
              </li>
            ),
          )}
        </ol>
      )}
    </aside>
  );
}
