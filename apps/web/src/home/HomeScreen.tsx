import { BOT_LEVELS, type BotLevel } from '@tamalou/bots';
import { PRESETS, type RuleSetInput, type RulesChoice, rulesFromPreset } from '@tamalou/shared';
import { useState } from 'react';
import { type Key, plural, t } from '../i18n/index.ts';
import { countChanges, RulesEditor } from '../rules/RulesEditor.tsx';
import { MAX_SEATS, MODE_DEFAULTS, type Mode } from './modes.ts';

// The setup: solo against bots, or several players sharing this device (pass-and-play, with bots or not); how strong
// the bots are; which rules (a preset, and the game master's changes made in the rules editor, measured against the
// mode's own defaults). The last choices are remembered on this device (a convenience only: a private window simply
// starts from the defaults). Rules received by link replace the remembered ones.

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

export function loadChoice(): GameChoice {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return DEFAULT;
    const c = JSON.parse(raw) as Partial<GameChoice>;
    const mode: Mode = c.mode === 'pass' ? 'pass' : 'solo';
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

/** A player's name as typed, or "Joueur n" when left empty. */
export const playerName = (typed: string, i: number) => typed.trim() || t('playerN', { n: i + 1 });

const LEVEL_KEY: Record<BotLevel, Key> = { easy: 'levelEasy', medium: 'levelMedium', hard: 'levelHard' };

interface Props {
  onPlay: (c: GameChoice) => void;
  /** Rules opened from a shared link. */
  linked?: RulesChoice | null;
}

export function HomeScreen({ onPlay, linked }: Props) {
  const [c, setC] = useState<GameChoice>(() => {
    const stored = loadChoice();
    return linked ? { ...stored, preset: linked.preset, overrides: linked.overrides } : stored;
  });
  const [editing, setEditing] = useState(false);
  const set = (patch: Partial<GameChoice>) => setC((prev) => fit({ ...prev, ...patch }));
  const play = () => {
    saveChoice(c);
    onPlay(c);
  };
  const changes = countChanges(c.overrides);
  const minBots = c.mode === 'solo' ? 1 : 0;
  const maxBots = c.mode === 'solo' ? MAX_SEATS - 1 : MAX_SEATS - c.players.length;

  if (editing) {
    return (
      <RulesEditor
        choice={{ preset: c.preset, overrides: c.overrides }}
        base={MODE_DEFAULTS[c.mode]}
        onChange={(r) => set({ preset: r.preset, overrides: r.overrides })}
        onDone={() => {
          saveChoice(c);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <main className="home">
      <div className="brand">
        <h1>{t('appName')}</h1>
        <p className="tagline">{t('tagline')}</p>
      </div>
      <form
        className="setup"
        onSubmit={(e) => {
          e.preventDefault();
          play();
        }}
      >
        <fieldset className="field">
          <legend>{t('homeMode')}</legend>
          <div className="segmented two">
            {(['solo', 'pass'] as const).map((m) => (
              <label key={m} className={c.mode === m ? 'on' : ''}>
                <input type="radio" name="mode" checked={c.mode === m} onChange={() => set({ mode: m })} />
                {t(m === 'solo' ? 'homeModeSolo' : 'homeModePass')}
              </label>
            ))}
          </div>
          {c.mode === 'pass' ? <small className="muted">{t('passHint')}</small> : null}
        </fieldset>

        {c.mode === 'solo' ? (
          <label className="field">
            <span>{t('homeName')}</span>
            <input
              value={c.name}
              maxLength={20}
              placeholder={t('homeNameDefault')}
              autoComplete="nickname"
              onChange={(e) => set({ name: e.target.value })}
            />
          </label>
        ) : (
          <fieldset className="field">
            <legend>{t('homePlayers')}</legend>
            <div className="players">
              {c.players.map((p, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a seat is its place in the list
                <div key={i} className="player-row">
                  <input
                    value={p}
                    maxLength={20}
                    placeholder={t('playerN', { n: i + 1 })}
                    aria-label={t('playerN', { n: i + 1 })}
                    onChange={(e) => set({ players: c.players.map((q, j) => (j === i ? e.target.value : q)) })}
                  />
                  {c.players.length > 2 ? (
                    <button
                      type="button"
                      className="ghost"
                      aria-label={t('removePlayer', { name: playerName(p, i) })}
                      onClick={() => set({ players: c.players.filter((_, j) => j !== i) })}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              ))}
              {/* A new player takes a bot's seat when the table is full (fit). */}
              <button
                type="button"
                className="btn btn-secondary"
                disabled={c.players.length >= MAX_SEATS}
                onClick={() => set({ players: [...c.players, ''] })}
              >
                {t('addPlayer')}
              </button>
            </div>
          </fieldset>
        )}

        <div className="field">
          <span id="bots-label">{t(c.mode === 'solo' ? 'homeBots' : 'homeBotsExtra')}</span>
          <fieldset className="stepper" aria-labelledby="bots-label">
            <button
              type="button"
              aria-label={t('fewer')}
              disabled={c.bots <= minBots}
              onClick={() => set({ bots: c.bots - 1 })}
            >
              −
            </button>
            <output className="mono" aria-live="polite">
              {c.bots}
            </output>
            <button
              type="button"
              aria-label={t('more')}
              disabled={c.bots >= maxBots}
              onClick={() => set({ bots: c.bots + 1 })}
            >
              +
            </button>
          </fieldset>
        </div>

        {c.bots > 0 ? (
          <fieldset className="field">
            <legend>{t('homeLevel')}</legend>
            <div className="segmented">
              {BOT_LEVELS.map((l) => (
                <label key={l} className={c.level === l ? 'on' : ''}>
                  <input
                    type="radio"
                    name="level"
                    value={l}
                    checked={c.level === l}
                    onChange={() => set({ level: l })}
                  />
                  {t(LEVEL_KEY[l])}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <fieldset className="field">
          <legend>{t('homePreset')}</legend>
          <div className="presets">
            {PRESETS.map((p) => (
              <label key={p.id} className={c.preset === p.id ? 'on' : ''}>
                <input
                  type="radio"
                  name="preset"
                  value={p.id}
                  checked={c.preset === p.id}
                  onChange={() => set({ preset: p.id, overrides: {} })}
                />
                <b>{p.name}</b>
                <small>{p.description}</small>
              </label>
            ))}
          </div>
          {linked ? <p className="notice">{t('editorFromLink')}</p> : null}
          <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>
            {t('editorCustomize')}
            {changes > 0 ? <span className="tag">{plural('editorModified', changes)}</span> : null}
          </button>
        </fieldset>

        <button type="submit" className="btn btn-primary btn-big">
          {t('homePlay')}
        </button>
      </form>
    </main>
  );
}
