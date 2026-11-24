import { type Card, POWERS, type Power, RANKS, type Rank, type RuleSet, type Suit } from '@tamalou/shared';
import { type ReactNode, useState } from 'react';
import { CardView } from '../cards/CardView.tsx';
import { Icon } from '../game/ActionBar.tsx';
import { PowerMark } from '../game/PowerMark.tsx';
import { type Key, plural, rankName, t } from '../i18n/index.ts';
import { displayNumber, type Field, getAt } from './fields.ts';

// One setting of the game master's screen, drawn for a phone (the owner's pick H on the 2026-11-24 canvas): a switch
// with a knob, a − / + pill, a row of pills for a choice, and the per-card settings (values, powers, the cards seen at
// the start) on cards drawn by the card theme, touched to be set.

type Update = (path: readonly string[], value: unknown) => void;

const SUIT_SETS: { id: string; suits: Suit[]; label: Key | null; symbol?: string }[] = [
  { id: 'all', suits: [], label: 'suitsAll' },
  { id: 'red', suits: ['H', 'D'], label: 'suitsRed' },
  { id: 'black', suits: ['S', 'C'], label: 'suitsBlack' },
  { id: 'S', suits: ['S'], label: null, symbol: '♠' },
  { id: 'H', suits: ['H'], label: null, symbol: '♥' },
  { id: 'D', suits: ['D'], label: null, symbol: '♦' },
  { id: 'C', suits: ['C'], label: null, symbol: '♣' },
];
const suitSetOf = (suits: Suit[]) =>
  SUIT_SETS.find((s) => JSON.stringify(s.suits) === JSON.stringify(suits))?.id ?? 'all';

/** The suit each rank is drawn in, as the in-game rules draw them (RulesCards' values picture). */
const SUIT_CYCLE: Suit[] = ['S', 'H', 'C', 'D'];
const faceOf = (rank: Rank, i: number): Card => ({
  id: -1,
  rank,
  suit: rank === 'JOKER' ? null : rank === 'K' ? 'S' : (SUIT_CYCLE[i % 4] as Suit),
  deck: 0,
});

const MINUS = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 12h14" />
  </svg>
);
const PLUS = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 12h14 M12 5v14" />
  </svg>
);

/** A − / + pill around a value. */
export function Stepper({
  value,
  shown = String(value),
  min,
  max,
  step = 1,
  onChange,
  label,
  describedBy,
  tone,
}: {
  value: number;
  shown?: ReactNode;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  label?: string;
  describedBy?: string;
  tone?: 'changed';
}) {
  return (
    <fieldset className="pill-stepper" aria-label={label} aria-describedby={describedBy}>
      <button
        type="button"
        aria-label={t('minus')}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
      >
        {MINUS}
      </button>
      <output className={`mono${tone === 'changed' ? ' changed' : ''}`} aria-live="polite">
        {shown}
      </output>
      <button
        type="button"
        aria-label={t('plus')}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + step))}
      >
        {PLUS}
      </button>
    </fieldset>
  );
}

/** A choice among a few, as pills with real radio buttons inside. */
function Pills<V extends string | number>({
  name,
  value,
  options,
  onChange,
  labelledBy,
  describedBy,
  list,
}: {
  name: string;
  value: V;
  options: { value: V; label: string; icon?: ReactNode }[];
  onChange: (v: V) => void;
  labelledBy?: string;
  describedBy?: string;
  /** One option per line, for long names (the powers). */
  list?: boolean;
}) {
  return (
    <div
      className={`pills${list ? ' list' : ''}`}
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
    >
      {options.map((o) => (
        <label key={o.value} className={value === o.value ? 'on' : ''}>
          <input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} />
          {o.icon}
          {o.label}
        </label>
      ))}
    </div>
  );
}

/** The ranks a table plays with: the joker only when the deck has it. */
const ranksOf = (rules: RuleSet) => RANKS.filter((r) => r !== 'JOKER' || rules.deck.jokers);

function RankValues({ field, rules, preset, update }: Props) {
  const ranks = ranksOf(rules);
  const [picked, setPicked] = useState<Rank>('K');
  const rank = ranks.includes(picked) ? picked : 'K';
  const value = rules.values.byRank[rank];
  const was = preset.values.byRank[rank];
  return (
    <div className="rank-cards">
      <p className="rule-tip">{t('editorTapValue')}</p>
      <div className="card-grid">
        {ranks.map((r, i) => {
          const v = rules.values.byRank[r];
          return (
            <div key={r} className="card-cell">
              <CardView
                card={faceOf(r, i)}
                label={`${rankName({ rank: r })}, ${plural('points', v)}`}
                size="sm"
                selected={r === rank}
                onSelect={() => setPicked(r)}
              />
              <span className={`value-chip mono${v !== preset.values.byRank[r] ? ' changed' : ''}`}>{v}</span>
            </div>
          );
        })}
      </div>
      <div className="rule-row">
        <div className="rule-text">
          <span id="rank-value-label">{rankName({ rank })}</span>
          <small>{value === was ? t('editorPresetValue') : t('editorPresetSays', { v: was })}</small>
        </div>
        <Stepper
          value={value}
          min={-50}
          max={50}
          label={rankName({ rank })}
          tone={value === was ? undefined : 'changed'}
          onChange={(v) => update([...field.path, rank], v)}
        />
      </div>
    </div>
  );
}

function RankPowers({ field, rules, preset, update }: Props) {
  const ranks = ranksOf(rules);
  const [picked, setPicked] = useState<Rank>('Q');
  const rank = ranks.includes(picked) ? picked : 'Q';
  return (
    <div className="rank-cards">
      <p className="rule-tip">{t('editorTapPower')}</p>
      <div className="card-grid">
        {ranks.map((r, i) => {
          const p = rules.powers.byRank[r];
          return (
            <div key={r} className="card-cell">
              <CardView
                card={faceOf(r, i)}
                label={`${rankName({ rank: r })}, ${t(`power_${p}` as Key)}`}
                size="sm"
                selected={r === rank}
                onSelect={() => setPicked(r)}
              />
              {p === 'none' ? (
                <span className="power-none" aria-hidden="true">
                  ·
                </span>
              ) : (
                <span className={p !== preset.powers.byRank[r] ? 'power-changed' : undefined}>
                  <PowerMark power={p} />
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="rule-row col">
        <div className="rule-text">
          <span id="rank-power-label">{rankName({ rank })}</span>
        </div>
        <Pills<Power>
          name="rank-power"
          labelledBy="rank-power-label"
          value={rules.powers.byRank[rank]}
          list
          options={POWERS.map((p) => ({
            value: p,
            label: t(`power_${p}` as Key),
            icon: p === 'none' ? <span className="power-none-mark" /> : <PowerMark power={p} />,
          }))}
          onChange={(p) => update([...field.path, rank], p)}
        />
      </div>
    </div>
  );
}

function Overrides({ field, rules, update }: Props) {
  const list = rules.values.overrides;
  const set = (i: number, patch: Partial<(typeof list)[number]>) =>
    update(
      field.path,
      list.map((o, j) => (j === i ? { ...o, ...patch } : o)),
    );
  return (
    <div className="overrides">
      {list.map((o, i) => {
        const suits: (Suit | null)[] = o.rank === 'JOKER' ? [null] : o.suits.length ? o.suits : ['S', 'H', 'D', 'C'];
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: rows have no identity but their place
          <div key={i} className="override">
            <span className="override-cards rt-fan" aria-hidden="true">
              {suits.map((s, k) => (
                <span
                  key={s ?? 'joker'}
                  className="rt-pic"
                  style={{
                    rotate: `${(k - (suits.length - 1) / 2) * 8}deg`,
                    marginLeft: k ? 'calc(var(--w) * -0.6)' : 0,
                  }}
                >
                  <CardView card={{ id: -1, rank: o.rank, suit: s, deck: 0 }} label="" size="sm" />
                </span>
              ))}
            </span>
            <div className="override-picks">
              <select
                aria-label={t('overrideRank')}
                value={o.rank}
                onChange={(e) => set(i, { rank: e.target.value as Rank })}
              >
                {RANKS.map((rank) => (
                  <option key={rank} value={rank}>
                    {rankName({ rank })}
                  </option>
                ))}
              </select>
              <select
                aria-label={t('overrideSuits')}
                value={suitSetOf(o.suits)}
                onChange={(e) => set(i, { suits: SUIT_SETS.find((s) => s.id === e.target.value)?.suits ?? [] })}
              >
                {SUIT_SETS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label ? t(s.label) : s.symbol}
                  </option>
                ))}
              </select>
            </div>
            <Stepper
              value={o.value}
              min={-50}
              max={50}
              label={t('overrideValue')}
              onChange={(v) => set(i, { value: v })}
            />
            <button
              type="button"
              className="override-remove"
              aria-label={t('removeOverride')}
              onClick={() =>
                update(
                  field.path,
                  list.filter((_, j) => j !== i),
                )
              }
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12 M18 6 6 18" />
              </svg>
            </button>
          </div>
        );
      })}
      <button
        type="button"
        className="override-add"
        onClick={() => update(field.path, [...list, { rank: 'K', suits: ['H', 'D'], value: 0 }])}
      >
        {PLUS}
        {t('addOverride')}
      </button>
    </div>
  );
}

function PeekSlots({ field, rules, update }: Props) {
  const slots = rules.hand.initialPeek.slots;
  return (
    <div className="peek-felt">
      <div
        className="peek-hand"
        style={{ gridTemplateColumns: `repeat(${Math.min(rules.hand.columns, rules.hand.size)}, auto)` }}
      >
        {Array.from({ length: rules.hand.size }, (_, s) => {
          const seen = slots.includes(s);
          return (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: a slot is its index
              key={s}
              type="button"
              className="peek-slot"
              aria-pressed={seen}
              aria-label={t(seen ? 'editorSeenSlot' : 'editorHiddenSlot', { n: s + 1 })}
              onClick={() =>
                update(field.path, seen ? slots.filter((x) => x !== s) : [...slots, s].sort((a, b) => a - b))
              }
            >
              <CardView card={null} label="" size="sm" />
              {seen ? (
                <span className="rt-eye" aria-hidden="true">
                  <Icon name="look" />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <p className="rule-tip">{t('rule_peekSlots_help')}</p>
    </div>
  );
}

interface Props {
  field: Field;
  rules: RuleSet;
  /** The rules of the chosen preset (and the mode's defaults), to mark what the game master changed. */
  preset: RuleSet;
  update: Update;
}

export function FieldRow(props: Props) {
  const { field: f, rules, preset, update } = props;
  const label = t(`rule_${f.id}` as Key);
  const help = t(`rule_${f.id}_help` as Key);
  const id = `rule-${f.id}`;
  const value = getAt(rules, f.path);

  // The per-card settings are drawn whole: their own words sit on the cards.
  if (f.kind === 'rankValues') return <RankValues {...props} />;
  if (f.kind === 'rankPowers') return <RankPowers {...props} />;
  if (f.kind === 'peekSlots') return <PeekSlots {...props} />;

  let control: ReactNode = null;
  let stacked = false;
  switch (f.kind) {
    case 'toggle':
      control = (
        <button
          type="button"
          role="switch"
          id={id}
          aria-checked={value === true}
          aria-describedby={`${id}-help`}
          className="knob-switch"
          onClick={() => update(f.path, !value)}
        >
          <span />
        </button>
      );
      break;
    case 'number': {
      const n = value as number;
      if (f.id === 'deckCount') {
        stacked = true;
        control = (
          <div className="deck-picks">
            {[1, 2].map((count) => (
              <button
                key={count}
                type="button"
                aria-pressed={n === count}
                className={n === count ? 'on' : ''}
                onClick={() => update(f.path, count)}
              >
                <span className="rt-fan" aria-hidden="true">
                  {Array.from({ length: count }, (_, i) => (
                    <span
                      // biome-ignore lint/suspicious/noArrayIndexKey: a fixed picture
                      key={i}
                      className="rt-pic"
                      style={{
                        rotate: `${count === 1 ? 0 : i ? 6 : -6}deg`,
                        marginLeft: i ? 'calc(var(--w) * -0.5)' : 0,
                      }}
                    >
                      <CardView card={null} label="" size="sm" />
                    </span>
                  ))}
                </span>
                {plural('editorDecks', count)}
              </button>
            ))}
          </div>
        );
        break;
      }
      const unit = f.unit === 'points' ? t('unitPoints') : f.unit ? t('unitSeconds') : '';
      const shown = displayNumber(f, n);
      control = (
        <Stepper
          value={n}
          shown={
            <>
              {shown}
              {unit ? <small> {unit}</small> : null}
            </>
          }
          min={f.min}
          max={f.max}
          step={f.step}
          label={label}
          describedBy={`${id}-help`}
          tone={n === getAt(preset, f.path) ? undefined : 'changed'}
          onChange={(v) => update(f.path, v)}
        />
      );
      break;
    }
    case 'select':
      stacked = true;
      control = (
        <Pills
          name={id}
          labelledBy={`${id}-label`}
          describedBy={`${id}-help`}
          value={value as string}
          options={f.options.map((o) => ({ value: o.value, label: t(o.label) }))}
          onChange={(v) => update(f.path, v)}
        />
      );
      break;
    case 'overrides':
      stacked = true;
      control = <Overrides {...props} />;
      break;
  }

  return (
    <div className={`rule-row${stacked ? ' col' : ''}`}>
      <div className="rule-text">
        {f.kind === 'toggle' ? (
          <label htmlFor={id} id={`${id}-label`}>
            {label}
          </label>
        ) : (
          <span id={`${id}-label`}>{label}</span>
        )}
        <small id={`${id}-help`}>{help}</small>
      </div>
      {control}
    </div>
  );
}
