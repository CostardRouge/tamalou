import { BOT_LEVELS, type BotLevel } from '@tamalou/bots';
import { type Card, PRESETS, type RuleSetInput, type RulesChoice, rulesFromPreset } from '@tamalou/shared';
import { useState } from 'react';
import { CardView } from '../cards/CardView.tsx';
import { type Key, plural, presetText, t } from '../i18n/index.ts';
import { countChanges, RulesEditor } from '../rules/RulesEditor.tsx';
import { VERSION } from '../version.ts';
import { Deal } from './Deal.tsx';
import { MAX_SEATS, MODE_DEFAULTS, type Mode } from './modes.ts';
import { Settings } from './Settings.tsx';
import { MODE_KEY, meOf, othersOf, SetupSheet, titleOf } from './Setup.tsx';

// The launch screen (the owner's pick on the 2026-10-22 canvas): the last game, ready to play again in one touch, then
// the three ways to play, each opening a panel with the table to set (Setup.tsx); "Jouer" deals the cards (Deal.tsx)
// before the game. The setup: solo against bots, or several players sharing this device (pass-and-play, with bots or
// not); how strong the bots are; which rules (a preset, and the game master's changes made in the rules editor,
// measured against the mode's own defaults). The last choices are remembered on this device (a convenience only: a
// private window simply starts from the defaults). Rules received by link replace the remembered ones. This device's
// settings (language, sounds, the hand's layout…) sit behind the button at the top.

export { playerName } from './Setup.tsx';

export interface GameChoice {
  mode: Mode;
  /** Solo: the player's name. */
  name: string;
  /** Pass-and-play: the players' names, in seat order. */
  players: string[];
  bots: number;
  level: BotLevel;
  preset: string;
  overrides: RuleSetInput;
}

const KEY = 'tamalou-solo';
const DEFAULT: GameChoice = {
  mode: 'solo',
  name: '',
  players: ['', ''],
  bots: 2,
  level: 'medium',
  preset: 'classic',
  overrides: {},
};

/** Stored overrides are kept only if they still make valid rules with their preset (a schema may have moved). */
function validOverrides(preset: string, overrides: unknown): RuleSetInput {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) return {};
  try {
    rulesFromPreset(preset, overrides as RuleSetInput);
    return overrides as RuleSetInput;
  } catch {
    return {};
  }
}

/** A setup was remembered: the launch screen offers it as the last game rather than as the first. */
function hasChoice(): boolean {
  try {
    return Boolean(globalThis.localStorage?.getItem(KEY));
  } catch {
    return false;
  }
}

export function loadChoice(): GameChoice {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return DEFAULT;
    const c = JSON.parse(raw) as Partial<GameChoice>;
    const mode: Mode = c.mode === 'pass' || c.mode === 'online' ? c.mode : 'solo';
    const players = Array.isArray(c.players)
      ? c.players.filter((p): p is string => typeof p === 'string').map((p) => p.slice(0, 20))
      : DEFAULT.players;
    const preset = PRESETS.some((p) => p.id === c.preset) ? (c.preset as string) : DEFAULT.preset;
    const choice: GameChoice = {
      mode,
      name: typeof c.name === 'string' ? c.name.slice(0, 20) : '',
      players: players.length >= 2 && players.length <= MAX_SEATS ? players : DEFAULT.players,
      bots: typeof c.bots === 'number' && c.bots >= 0 && c.bots <= 5 ? c.bots : DEFAULT.bots,
      level: BOT_LEVELS.includes(c.level as BotLevel) ? (c.level as BotLevel) : DEFAULT.level,
      preset,
      overrides: {},
    };
    return fit({ ...choice, overrides: validOverrides(preset, c.overrides) });
  } catch {
    return DEFAULT;
  }
}

function saveChoice(c: GameChoice) {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(c));
  } catch {
    // Storage refused: nothing to remember, nothing breaks.
  }
}

/** Keeps the table playable: solo needs a bot, and nobody plays at more than six. */
function fit(c: GameChoice): GameChoice {
  if (c.mode === 'solo') return { ...c, bots: Math.min(Math.max(c.bots, 1), MAX_SEATS - 1) };
  return { ...c, bots: Math.min(c.bots, MAX_SEATS - c.players.length) };
}

/** The remembered setup, in the given mode (the icon's shortcuts, ADR-0020): solo keeps at least one bot. */
export const choiceFor = (mode: Mode): GameChoice => fit({ ...loadChoice(), mode });

const MODES: Mode[] = ['solo', 'pass', 'online'];
const MODE_TEXT: Record<Mode, Key> = {
  solo: 'homeModeSoloText',
  pass: 'homeModePassText',
  online: 'homeModeOnlineText',
};
const MODE_ICON: Record<Mode, string> = {
  solo: 'M12 3v3M8 6h8a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3zM9.5 11h.01M14.5 11h.01M9.5 15h5',
  pass: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2',
  online: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18',
};
const LEVEL_CHIP: Record<BotLevel, Key> = {
  easy: 'levelChip_easy',
  medium: 'levelChip_medium',
  hard: 'levelChip_hard',
};
const KING: Card = { id: -2, rank: 'K', suit: 'H', deck: 0 };

interface Props {
  onPlay: (c: GameChoice) => void;
  /** Rules opened from a shared link. */
  linked?: RulesChoice | null;
  /** This page's server hosts rooms (LAN server, online): the online mode is offered. */
  online?: boolean;
  /** Enter a room (made or typed here) under this name. */
  onRoom?: (code: string, name: string) => void;
  /** Open on this mode's panel rather than on the last game (the icon's shortcuts). */
  mode?: Mode;
}

export function HomeScreen({ onPlay, linked, online = false, onRoom, mode }: Props) {
  const withLink = (c: GameChoice) => (linked ? { ...c, preset: linked.preset, overrides: linked.overrides } : c);
  // The last game, as remembered: what "Rejouer" plays. The panel edits a copy, kept when it is played.
  const [saved, setSaved] = useState<GameChoice>(() => withLink(loadChoice()));
  const [first] = useState(() => !hasChoice());
  const [stored, setC] = useState<GameChoice>(() => withLink(mode ? choiceFor(mode) : loadChoice()));
  // A remembered online choice on a page without rooms (GitHub Pages) falls back to solo.
  const c = stored.mode === 'online' && !online ? { ...stored, mode: 'solo' as const } : stored;
  // Rules received by link open the panel on them: the player came for that table.
  const [sheet, setSheet] = useState(Boolean(mode || linked));
  const [editing, setEditing] = useState(false);
  const [settings, setSettings] = useState(false);
  const [dealing, setDealing] = useState<GameChoice | null>(null);
  const set = (patch: Partial<GameChoice>) => setC((prev) => fit({ ...prev, ...patch }));
  const start = (choice: GameChoice) => {
    saveChoice(choice);
    setSaved(choice);
    setDealing(choice);
  };

  if (editing) {
    return (
      <RulesEditor
        choice={{ preset: c.preset, overrides: c.overrides }}
        base={MODE_DEFAULTS[c.mode]}
        onChange={(r) => set({ preset: r.preset, overrides: r.overrides })}
        onDone={() => setEditing(false)}
      />
    );
  }

  if (dealing) {
    return <Deal me={meOf(dealing)} others={othersOf(dealing)} onDone={() => onPlay(dealing)} />;
  }

  // An online game is not replayed from here: its rules and seats are the room's.
  const last = saved.mode === 'online' ? null : saved;
  const modes = online ? MODES : MODES.slice(0, 2);
  return (
    <main className="home">
      <header className="home-bar">
        <h1>{t('appName')}</h1>
        <button type="button" className="icon-btn" aria-label={t('settings')} onClick={() => setSettings(true)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
            <circle cx="15" cy="7" r="2" />
            <circle cx="9" cy="17" r="2" />
          </svg>
        </button>
      </header>

      {last ? <LastGame c={last} first={first} onPlay={() => start(last)} /> : null}

      <h2 className="home-more">{t(last ? 'homeOther' : 'homeChoose')}</h2>
      <div className="mode-tiles">
        {modes.map((m) => (
          <button
            key={m}
            type="button"
            className={`mode-tile mode-${m}`}
            onClick={() => {
              setC(fit({ ...withLink(saved), mode: m }));
              setSheet(true);
            }}
          >
            <span className="mode-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d={MODE_ICON[m]} />
              </svg>
            </span>
            <span className="mode-words">
              <b>{t(MODE_KEY[m])}</b>
              <small>{t(MODE_TEXT[m])}</small>
            </span>
            <svg className="mode-go" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        ))}
      </div>

      <footer className="home-foot">
        {/* The site's home page (ADR-0017): what the game is, a first round, the rules; in this language. */}
        <a href={t('siteHref')}>{t('siteLink')}</a>
        <a href={t('legalHref')}>{t('legalLink')}</a>
        <p className="version mono">v{VERSION}</p>
      </footer>

      {sheet ? (
        <SetupSheet
          c={c}
          set={set}
          linked={Boolean(linked)}
          changes={countChanges(c.overrides)}
          onClose={() => setSheet(false)}
          onPlay={() => start(c)}
          onEdit={() => setEditing(true)}
          onRoom={(code, name) => {
            saveChoice(c);
            onRoom?.(code, name);
          }}
        />
      ) : null}

      {settings ? (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="settings-title">
          <div className="panel settings-panel">
            <Settings onClose={() => setSettings(false)} />
          </div>
        </div>
      ) : null}
    </main>
  );
}

/** The last game (or, on a first visit, the default one), ready to play again in one touch. */
function LastGame({ c, first, onPlay }: { c: GameChoice; first: boolean; onPlay: () => void }) {
  const changes = countChanges(c.overrides);
  const preset = PRESETS.find((p) => p.id === c.preset);
  return (
    <section className="last-game" aria-labelledby="last-title">
      <div className="last-cards" aria-hidden="true">
        <CardView card={null} label="" size="sm" />
        <CardView card={null} label="" size="sm" />
        <CardView card={KING} label="" size="sm" />
      </div>
      <p className="last-kicker">{t(first ? 'heroFirst' : 'heroLast')}</p>
      <h2 id="last-title">{titleOf(c)}</h2>
      <ul className="last-chips">
        {c.bots > 0 ? <li>{t(LEVEL_CHIP[c.level])}</li> : null}
        {preset ? <li>{presetText(preset.id, preset).name}</li> : null}
        {changes > 0 ? <li>{plural('editorModified', changes)}</li> : null}
      </ul>
      <button type="button" className="last-play" onClick={onPlay}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 4.5v15l12-7.5z" />
        </svg>
        {t(first ? 'homePlay' : 'heroReplay')}
      </button>
    </section>
  );
}
