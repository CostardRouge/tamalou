// The action bar, always one line (the owner's design A, 2026-10-17): the main action takes the room left, every other
// action is a square icon with a one-word caption. Plain choices without an icon (who claims a quick discard on a
// shared screen) stay text buttons, and the line scrolls sideways rather than wrap.

export type ActIcon = 'take' | 'call' | 'quick' | 'skip' | 'keep' | 'pass' | 'cancel' | 'look' | 'discard' | 'draw';

export interface Act {
  key: string;
  /** The full label: the wide button's text, the icon button's accessible name. */
  label: string;
  /** One word under the icon. */
  caption?: string;
  icon?: ActIcon;
  tone?: 'primary' | 'secondary' | 'call' | 'good';
  /** Drawn as the wide button. The first such action wins; with none, the first action is if it has an icon. */
  main?: boolean;
  /** Never the wide button, even alone: a second way to do something done by hand (the quick discard's bolt). */
  minor?: boolean;
  /** An armed mode is on (the quick discard waiting for a card). */
  on?: boolean;
  onClick: () => void;
}

const PATHS: Record<ActIcon, string> = {
  draw: 'M7 3h10v14H7z M12 21v-6 M9 18l3-3 3 3',
  take: 'M5 4h10v14H5z M19 12h-8 M14 9l-3 3 3 3',
  call: 'M3 10v4h3l7 5V5L6 10H3z M17 9a4 4 0 0 1 0 6 M19.5 6.5a8 8 0 0 1 0 11',
  quick: 'M13 2 4 14h7l-1 8 9-12h-7l1-8z',
  skip: 'M5 5l7 7-7 7 M13 5l7 7-7 7',
  keep: 'M5 12l5 5L20 7',
  pass: 'M4 12h14 M13 6l6 6-6 6',
  cancel: 'M6 6l12 12 M18 6 6 18',
  look: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  discard: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13',
};

export function Icon({ name }: { name: ActIcon }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

/** `hint`: a short line beside the icons, when no wide button takes the room (how to do it by hand instead). */
export function ActionBar({ acts, hint }: { acts: Act[]; hint?: string | null }) {
  const marked = acts.findIndex((a) => a.main);
  const mainIndex = marked >= 0 ? marked : acts[0]?.icon && !acts[0].minor ? 0 : -1;
  return (
    <div className="bar">
      {hint && mainIndex < 0 ? <p className="bar-hint">{hint}</p> : null}
      {acts.map((a, i) =>
        i === mainIndex || !a.icon ? (
          <button
            key={a.key}
            type="button"
            className={`btn btn-${a.tone ?? 'secondary'}${i === mainIndex ? ' bar-main' : ''}`}
            onClick={a.onClick}
          >
            {a.label}
          </button>
        ) : (
          <button
            key={a.key}
            type="button"
            className={`ibtn ibtn-${a.tone ?? 'secondary'}${a.on ? ' ibtn-on' : ''}`}
            aria-label={a.label}
            aria-pressed={a.on === undefined ? undefined : a.on}
            onClick={a.onClick}
          >
            <Icon name={a.icon} />
            <small aria-hidden="true">{a.caption ?? a.label}</small>
          </button>
        ),
      )}
    </div>
  );
}
