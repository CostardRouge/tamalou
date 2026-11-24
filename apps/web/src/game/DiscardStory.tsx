import type { Avatar as AvatarValue, PlayerId } from '@tamalou/shared';
import { useState } from 'react';
import { CardView } from '../cards/CardView.tsx';
import { cardName, plural, t } from '../i18n/index.ts';
import { Avatar } from '../profile/Avatar.tsx';
import { Icon } from './ActionBar.tsx';
import type { DiscardStory as Story } from './discardStory.ts';
import { storyLine } from './discardStory.ts';
import { Overlay } from './Overlay.tsx';

// The discard laid out (the owner's pick E, rule assist.discardStory, ADR-0026): opened by its own icon beside the
// discard, never by a touch on the discard, which takes it. The cards in a row, newest first, with who threw each; a
// card taken back is faded; a touch on one tells its story.

const HISTORY = (
  <svg className="bar-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 12a9 9 0 1 0 3-6.7 M3 4v5h5 M12 8v4l3 2" />
  </svg>
);

/** The icon beside the discard, with the number of cards on it. */
export function StoryButton({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <button type="button" className="story-btn" aria-label={plural('storyOpen', count)} onClick={onOpen}>
      {HISTORY}
      <span className="story-count mono" aria-hidden="true">
        {count}
      </span>
    </button>
  );
}

interface Props {
  story: Story;
  me: PlayerId;
  nameOf: (id: PlayerId) => string;
  faceOf: (id: PlayerId) => AvatarValue;
  onClose: () => void;
}

export function DiscardStoryPanel({ story, me, nameOf, faceOf, onClose }: Props) {
  const [picked, setPicked] = useState(0);
  const chosen = story.cards[Math.min(picked, story.cards.length - 1)];
  const taken = story.cards.filter((c) => c.takenBy).length;
  const count = story.cards.length - taken;
  return (
    <Overlay labelledBy="story-title" onClose={onClose}>
      <div className="panel story">
        <div className="panel-head">
          <div>
            <h2 id="story-title">{t('storyTitle')}</h2>
            <p className="muted small">
              {t(story.reshuffled ? 'storySince' : 'storyOrder')} · {plural('storyCount', count)}
              {taken ? ` · ${plural('storyTaken', taken)}` : ''}
            </p>
          </div>
          <button type="button" className="ghost" onClick={onClose} ref={(el) => el?.focus()}>
            {t('close')}
          </button>
        </div>
        <div className="story-row">
          {story.cards.map((c, i) => (
            <button
              key={c.key}
              type="button"
              className={`story-card${c === chosen ? ' on' : ''}${c.takenBy ? ' taken' : ''}`}
              aria-pressed={c === chosen}
              aria-label={t('storyCard', { card: cardName(c.card), how: storyLine(c, nameOf, me) })}
              onClick={() => setPicked(i)}
            >
              <span className="story-face" aria-hidden="true">
                <CardView card={c.card} label="" size="sm" />
              </span>
              <span className="story-who" aria-hidden="true">
                {c.by ? <Avatar avatar={faceOf(c.by)} size="xs" /> : <span className="story-deal">T</span>}
                {c.power && c.power !== 'none' ? (
                  <span className="story-mark">
                    <Icon name={c.power === 'blindSwap' ? 'swap' : 'look'} />
                  </span>
                ) : null}
                {c.takenBy ? <span className="story-taken">{t('storyTakenMark')}</span> : null}
              </span>
            </button>
          ))}
        </div>
        {chosen ? (
          <p className="story-line" aria-live="polite">
            <b>{cardName(chosen.card)}</b> — {storyLine(chosen, nameOf, me)}
          </p>
        ) : null}
      </div>
    </Overlay>
  );
}
