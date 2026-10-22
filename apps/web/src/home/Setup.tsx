import { BOT_LEVELS, type BotLevel } from '@tamalou/bots';
import { type Card, normalizeRoomCode, PRESETS } from '@tamalou/shared';
import { useState } from 'react';
import { trackEvent } from '../audience.ts';
import { CardView } from '../cards/CardView.tsx';
import { createRoom } from '../connection/remote.ts';
import { currentLang, type Key, plural, presetText, t } from '../i18n/index.ts';
import type { GameChoice } from './HomeScreen.tsx';
import { MAX_SEATS, type Mode } from './modes.ts';
import { aroundTop } from './table.ts';

// The panel a mode opens on the launch screen (the owner's pick on the 2026-10-22 canvas: direction B with A's table
// inside): the table to set, with the others seated round the top — a "+" seat adds one, the last bot's × takes it
// away — and my name at the bottom; then the bots' level, the rules as cards, and "Jouer". Online, it is the way into
// a room instead.

export const LEVEL_KEY: Record<BotLevel, Key> = { easy: 'levelEasy', medium: 'levelMedium', hard: 'levelHard' };
export const MODE_KEY: Record<Mode, Key> = { solo: 'homeModeSolo', pass: 'homeModePass', online: 'homeModeOnline' };

/** A player's name as typed, or "Joueur n" when left empty. */
export const playerName = (typed: string, i: number) => typed.trim() || t('playerN', { n: i + 1 });

/** The bots' names, in seat order, from the dictionary. */
export const botNameOf = (i: number) => t('botNames').split(',')[i] ?? t('botName', { n: i + 1 });

/** Who sits at the bottom of the table. */
export const meOf = (c: GameChoice) =>
  c.mode === 'solo' ? c.name.trim() || t('homeNameDefault') : playerName(c.players[0] ?? '', 0);

/** Everybody else, in seat order: the other players, then the bots. */
export const othersOf = (c: GameChoice) => [
  ...(c.mode === 'pass' ? c.players.slice(1).map((p, i) => playerName(p, i + 1)) : []),
  ...Array.from({ length: c.bots }, (_, i) => botNameOf(i)),
];

/** A setup in one line: "Toi contre Ada et Basile", "Ana, Ben et 1 bot". */
export function titleOf(c: GameChoice): string {
  const list = (xs: string[]) => new Intl.ListFormat(currentLang(), { type: 'conjunction' }).format(xs);
  if (c.mode === 'solo') {
    const others = c.bots > 3 ? plural('heroBots', c.bots) : list(othersOf(c));
    return t('heroVs', { me: c.name.trim() || t('heroYou'), others });
  }
  const humans = c.players.length > 3 ? [plural('heroPlayers', c.players.length)] : c.players.map(playerName);
  return list(c.bots > 0 ? [...humans, plural('heroBots', c.bots)] : humans);
}

const SEVEN: Card = { id: -1, rank: '7', suit: 'H', deck: 0 };

interface Props {
  c: GameChoice;
  set: (patch: Partial<GameChoice>) => void;
  /** The rules came with a shared link. */
  linked: boolean;
  /** The game master's changes to the preset. */
  changes: number;
  onClose: () => void;
  onPlay: () => void;
  onEdit: () => void;
  onRoom: (code: string, name: string) => void;
}

export function SetupSheet({ c, set, linked, changes, onClose, onPlay, onEdit, onRoom }: Props) {
  const preset = PRESETS.find((p) => p.id === c.preset);
  return (
    <div className="overlay sheet-overlay" role="dialog" aria-modal="true" aria-labelledby="setup-title">
      <div className="sheet">
        <div className="panel-head">
          <h2 id="setup-title">{t(MODE_KEY[c.mode])}</h2>
          <button type="button" className="ghost" onClick={onClose}>
            {t('close')}
          </button>
        </div>
        {c.mode === 'online' ? (
          <div className="setup-online">
            <p className="muted">{t('onlineHint')}</p>
            <OnlineForm name={c.name} onName={(name) => set({ name })} onRoom={onRoom} />
          </div>
        ) : (
          <form
            className="setup-form"
            onSubmit={(e) => {
              e.preventDefault();
              onPlay();
            }}
          >
            {c.mode === 'pass' ? <small className="muted">{t('passHint')}</small> : null}
            <Table c={c} set={set} />
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
              <div className="preset-cards">
                {PRESETS.map((p) => (
                  <label key={p.id} className={c.preset === p.id ? 'on' : ''}>
                    <input
                      type="radio"
                      name="preset"
                      value={p.id}
                      checked={c.preset === p.id}
                      onChange={() => set({ preset: p.id, overrides: {} })}
                    />
                    <b>{presetText(p.id, p).name}</b>
                    <small>{presetText(p.id, p).description}</small>
                  </label>
                ))}
              </div>
              {linked ? <p className="notice">{t('editorFromLink')}</p> : null}
              <button type="button" className="btn btn-secondary" onClick={onEdit}>
                {t('editorCustomize')}
                {changes > 0 ? <span className="tag">{plural('editorModified', changes)}</span> : null}
              </button>
            </fieldset>
            <div className="setup-go">
              <p className="muted">
                {titleOf(c)}
                {preset ? ` · ${presetText(preset.id, preset).name}` : ''}
              </p>
              <button type="submit" className="btn btn-primary btn-big">
                {t('homePlay')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

type Seat = { kind: 'bot'; i: number } | { kind: 'human'; i: number } | { kind: 'add'; what: 'bot' | 'human' };

/** The table to set: the others round the top, a "+" seat while there is room, me at the bottom. */
function Table({ c, set }: { c: GameChoice; set: (patch: Partial<GameChoice>) => void }) {
  const seats: Seat[] = [];
  if (c.mode === 'pass') for (let i = 1; i < c.players.length; i++) seats.push({ kind: 'human', i });
  for (let i = 0; i < c.bots; i++) seats.push({ kind: 'bot', i });
  const total = (c.mode === 'pass' ? c.players.length : 1) + c.bots;
  if (total < MAX_SEATS) {
    if (c.mode === 'pass') seats.push({ kind: 'add', what: 'human' });
    seats.push({ kind: 'add', what: 'bot' });
  }
  // Five seats or more open the arc wider and draw them smaller, so names and × marks keep clear of each other.
  const crowded = seats.length >= 5;
  const spots = aroundTop(seats.length, crowded ? 176 : 148);
  // Solo keeps at least one bot; the × sits on the last one, since bots are named by their seat.
  const lastBotRemovable = c.mode === 'solo' ? c.bots > 1 : c.bots > 0;
  return (
    <div className={`setup-table${crowded ? ' crowded' : ''}`}>
      <div className="setup-piles" aria-hidden="true">
        <CardView card={null} label="" size="sm" />
        <CardView card={SEVEN} label="" size="sm" />
      </div>
      {seats.map((s, k) => {
        const spot = spots[k] ?? { x: 50, y: 50 };
        const style = { left: `${spot.x}%`, top: `${spot.y}%` };
        if (s.kind === 'add') {
          const label = t(s.what === 'bot' ? 'addBot' : 'addPlayer');
          return (
            <div key={`add-${s.what}`} className="seat-spot" style={style}>
              <button
                type="button"
                className="seat-add"
                aria-label={label}
                onClick={() => set(s.what === 'bot' ? { bots: c.bots + 1 } : { players: [...c.players, ''] })}
              >
                +
              </button>
              <span className="seat-sub">{t(s.what === 'bot' ? 'seatAddBot' : 'seatAddPlayer')}</span>
            </div>
          );
        }
        if (s.kind === 'bot') {
          const name = botNameOf(s.i);
          return (
            <div key={`bot-${s.i}`} className="seat-spot" style={style}>
              <span className={`seat-avatar seat-c${(s.i % 5) + 1}`} aria-hidden="true">
                {name.slice(0, 1)}
              </span>
              {s.i === c.bots - 1 && lastBotRemovable ? (
                <button
                  type="button"
                  className="seat-remove"
                  aria-label={t('removeBot', { name })}
                  onClick={() => set({ bots: c.bots - 1 })}
                >
                  ×
                </button>
              ) : null}
              <span className="seat-name">{name}</span>
              <span className="seat-sub">{t(`botSub_${c.level}` as Key)}</span>
            </div>
          );
        }
        const typed = c.players[s.i] ?? '';
        return (
          <div key={`human-${s.i}`} className="seat-spot" style={style}>
            <span className="seat-avatar seat-human" aria-hidden="true">
              {playerName(typed, s.i).slice(0, 1)}
            </span>
            {c.players.length > 2 ? (
              <button
                type="button"
                className="seat-remove"
                aria-label={t('removePlayer', { name: playerName(typed, s.i) })}
                onClick={() => set({ players: c.players.filter((_, j) => j !== s.i) })}
              >
                ×
              </button>
            ) : null}
            <input
              className="seat-input"
              value={typed}
              maxLength={20}
              placeholder={t('playerN', { n: s.i + 1 })}
              aria-label={t('playerN', { n: s.i + 1 })}
              onChange={(e) => set({ players: c.players.map((q, j) => (j === s.i ? e.target.value : q)) })}
            />
          </div>
        );
      })}
      <div className="seat-spot seat-me">
        <span className="seat-avatar seat-mine" aria-hidden="true">
          {meOf(c).slice(0, 1)}
        </span>
        {c.mode === 'solo' ? (
          <input
            className="seat-input"
            value={c.name}
            maxLength={20}
            placeholder={t('homeNameDefault')}
            aria-label={t('homeName')}
            autoComplete="nickname"
            onChange={(e) => set({ name: e.target.value })}
          />
        ) : (
          <input
            className="seat-input"
            value={c.players[0] ?? ''}
            maxLength={20}
            placeholder={t('playerN', { n: 1 })}
            aria-label={t('playerN', { n: 1 })}
            onChange={(e) => set({ players: c.players.map((q, j) => (j === 0 ? e.target.value : q)) })}
          />
        )}
      </div>
    </div>
  );
}

/** Online: a name, then a new room or the code of a friend's. */
function OnlineForm({
  name,
  onName,
  onRoom,
}: {
  name: string;
  onName: (name: string) => void;
  onRoom: (code: string, name: string) => void;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<Key | null>(null);
  const [busy, setBusy] = useState(false);
  const typed = name.trim();
  const create = async () => {
    setBusy(true);
    setError(null);
    const made = await createRoom();
    setBusy(false);
    if (made) {
      trackEvent('room-created');
      onRoom(made, typed);
    } else setError('onlineCreateFailed');
  };
  const join = () => {
    const normal = normalizeRoomCode(code);
    if (normal) onRoom(normal, typed);
    else setError('onlineCodeInvalid');
  };
  return (
    <>
      <label className="field">
        <span>{t('homeName')}</span>
        <input value={name} maxLength={20} autoComplete="nickname" onChange={(e) => onName(e.target.value)} />
      </label>
      <button type="button" className="btn btn-primary btn-big" disabled={!typed || busy} onClick={create}>
        {t('onlineCreate')}
      </button>
      <p className="or muted">{t('onlineOr')}</p>
      <div className="field">
        <label htmlFor="room-code-input">{t('onlineCode')}</label>
        <div className="join-row">
          <input
            id="room-code-input"
            className="mono code-input"
            value={code}
            maxLength={7}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="ABCDE"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (typed) join();
              }
            }}
          />
          <button type="button" className="btn btn-secondary" disabled={!typed || !code.trim()} onClick={join}>
            {t('onlineJoin')}
          </button>
        </div>
      </div>
      {error ? (
        <p className="notice" role="alert">
          {t(error)}
        </p>
      ) : null}
    </>
  );
}
