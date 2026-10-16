import { BOT_LEVELS, type BotLevel } from '@tamalou/bots';
import { PRESETS } from '@tamalou/shared';
import { useState } from 'react';
import { type Key, t } from '../i18n/index.ts';

// The solo setup: a name, how many bots and how strong, which rules. The last choices are remembered on this device
// (a convenience only: a private window simply starts from the defaults).

export interface SoloChoice {
  name: string;
  bots: number;
  level: BotLevel;
  preset: string;
}

const KEY = 'tamalou-solo';
const DEFAULT: SoloChoice = { name: '', bots: 2, level: 'medium', preset: 'classic' };

export function loadChoice(): SoloChoice {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return DEFAULT;
    const c = JSON.parse(raw) as Partial<SoloChoice>;
    return {
      name: typeof c.name === 'string' ? c.name.slice(0, 20) : '',
      bots: typeof c.bots === 'number' && c.bots >= 1 && c.bots <= 5 ? c.bots : DEFAULT.bots,
      level: BOT_LEVELS.includes(c.level as BotLevel) ? (c.level as BotLevel) : DEFAULT.level,
      preset: PRESETS.some((p) => p.id === c.preset) ? (c.preset as string) : DEFAULT.preset,
    };
  } catch {
    return DEFAULT;
  }
}

function saveChoice(c: SoloChoice) {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(c));
  } catch {
    // Storage refused: nothing to remember, nothing breaks.
  }
}

const LEVEL_KEY: Record<BotLevel, Key> = { easy: 'levelEasy', medium: 'levelMedium', hard: 'levelHard' };

export function HomeScreen({ onPlay }: { onPlay: (c: SoloChoice) => void }) {
  const [c, setC] = useState<SoloChoice>(loadChoice);
  const set = (patch: Partial<SoloChoice>) => setC((prev) => ({ ...prev, ...patch }));
  const play = () => {
    saveChoice(c);
    onPlay(c);
  };

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
        <h2>{t('homeSolo')}</h2>

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

        <div className="field">
          <span id="bots-label">{t('homeBots')}</span>
          <fieldset className="stepper" aria-labelledby="bots-label">
            <button
              type="button"
              aria-label={t('fewer')}
              disabled={c.bots <= 1}
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
              disabled={c.bots >= 5}
              onClick={() => set({ bots: c.bots + 1 })}
            >
              +
            </button>
          </fieldset>
        </div>

        <fieldset className="field">
          <legend>{t('homeLevel')}</legend>
          <div className="segmented">
            {BOT_LEVELS.map((l) => (
              <label key={l} className={c.level === l ? 'on' : ''}>
                <input type="radio" name="level" value={l} checked={c.level === l} onChange={() => set({ level: l })} />
                {t(LEVEL_KEY[l])}
              </label>
            ))}
          </div>
        </fieldset>

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
                  onChange={() => set({ preset: p.id })}
                />
                <b>{p.name}</b>
                <small>{p.description}</small>
              </label>
            ))}
          </div>
        </fieldset>

        <button type="submit" className="btn btn-primary btn-big">
          {t('homePlay')}
        </button>
      </form>
    </main>
  );
}
