import {
  type Card,
  DEFAULT_RULES,
  type Power,
  type Rank,
  type RuleSet,
  STANDARD_RANKS,
  type Suit,
} from '@tamalou/shared';
import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { CardView } from '../cards/CardView.tsx';
import { getSettings, useSettings } from '../feedback/settings.ts';
import { cardName, rankName, t } from '../i18n/index.ts';
import { powerGroups, powerLine, type SummaryLine, summarize } from './summary.ts';

// The rules during a game, one illustrated card per rule to leaf through (the owner's design B, 2026-10-17). Every
// text and every picture comes from the table's RuleSet: a value, a power or a threshold the game master changed shows
// as it is tonight, and its card carries the "modifié" mark. The pictures are drawn with the card theme (ADR-0007).

interface Slide {
  key: string;
  title: string;
  lines: SummaryLine[];
  art: ReactNode;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const card = (rank: Rank, suit: Suit | null): Card => ({ id: -1, rank, suit, deck: 0 });
const SUIT_CYCLE: Suit[] = ['S', 'H', 'C', 'D'];

/** A card of the picture, face up or down, with an optional animation and a small tag. */
function Pic({
  c,
  anim,
  badge,
  tone,
  style,
}: {
  c: Card | null;
  anim?: string;
  badge?: ReactNode;
  tone?: 'b';
  style?: CSSProperties;
}) {
  return (
    <span className={`rc-pic${anim ? ` rc-${anim}` : ''}`} style={style}>
      <CardView card={c} label={c ? cardName(c) : t('cardHidden')} size="sm" />
      {badge ? <span className={`rc-badge${tone === 'b' ? ' rc-badge-b' : ''}`}>{badge}</span> : null}
    </span>
  );
}

const Tag = ({ children, tone, style }: { children: ReactNode; tone?: 'b' | 'g'; style?: CSSProperties }) => (
  <span className={`rc-tag${tone ? ` rc-tag-${tone}` : ''}`} style={style}>
    {children}
  </span>
);

const EYE = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
  </svg>
);
const LOCK = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 11h12v10H6z M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
  </svg>
);
const Arrow = ({ d, style }: { d: string; style: CSSProperties }) => (
  <svg className="rc-arrow" viewBox="0 0 60 40" style={style} aria-hidden="true">
    <path d={d} />
  </svg>
);

function HandArt({ r }: { r: RuleSet }) {
  const { size, columns, initialPeek } = r.hand;
  const seen = initialPeek.mode === 'fixed' ? initialPeek.slots : [];
  // Drawn in a line unless this device lays hands out in a grid (game/hand.ts), like the table and the summary.
  const cols = getSettings().hand === 'grid' ? columns : size;
  return (
    <div className="rc-row">
      <div className="grid rc-hand" style={{ '--cols': cols } as CSSProperties}>
        {Array.from({ length: size }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed picture
          <Pic key={i} c={null} anim={seen.includes(i) ? 'peek' : undefined} badge={seen.includes(i) ? EYE : null} />
        ))}
      </div>
      {seen.length > 0 ? <Tag>{t('rc_seen')}</Tag> : null}
    </div>
  );
}

function TurnArt() {
  return (
    <div className="rc-row">
      <Pic c={null} />
      <Arrow d="M4 26 C 20 6, 38 6, 54 18 M46 12 l8 6 -9 4" style={{ width: 44 }} />
      <Pic c={card('7', 'C')} anim="float" />
      <div className="rc-col">
        <Tag>{t('rc_you')}</Tag>
        <Tag tone="b">{t('discard')}</Tag>
      </div>
    </div>
  );
}

function cardValue(r: RuleSet, c: Card): number {
  const o = r.values.overrides.find(
    (x) => x.rank === c.rank && (x.suits.length === 0 || (c.suit && x.suits.includes(c.suit))),
  );
  return o ? o.value : r.values.byRank[c.rank];
}

function ValuesArt({ r }: { r: RuleSet }) {
  const cards = STANDARD_RANKS.map((rank, i) => card(rank, rank === 'K' ? 'S' : (SUIT_CYCLE[i % 4] as Suit)));
  for (const o of r.values.overrides) cards.push(card(o.rank, o.suits[0] ?? (o.rank === 'JOKER' ? null : 'H')));
  if (r.deck.jokers) cards.push(card('JOKER', null));
  return (
    <div className="rc-values">
      {cards.map((c, i) => {
        const v = cardValue(r, c);
        const special = i >= STANDARD_RANKS.length;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed picture
          <span key={i} className={`rc-value${special ? ' rc-special' : ''}`}>
            <Pic c={c} />
            <b className="mono">{v}</b>
          </span>
        );
      })}
    </div>
  );
}

function MiniHand({ peek, swap, tag }: { peek?: number; swap?: 'L' | 'R'; tag: string }) {
  return (
    <div className="rc-col">
      <div className="grid rc-mini" style={{ '--cols': 2 } as CSSProperties}>
        {[0, 1, 2, 3].map((i) => (
          <Pic
            key={i}
            c={null}
            anim={i === peek ? 'peek' : i === 1 && swap ? `swap${swap}` : undefined}
            badge={i === peek ? EYE : null}
          />
        ))}
      </div>
      <Tag>{tag}</Tag>
    </div>
  );
}

function PowerArt({ power, ranks }: { power: Power; ranks: Rank[] }) {
  const fan = ranks
    .slice(0, 3)
    .map((rank, i) => (
      <Pic
        key={rank}
        c={card(rank, rank === 'JOKER' ? null : (SUIT_CYCLE[i % 4] as Suit))}
        style={{ rotate: `${(i - (Math.min(ranks.length, 3) - 1) / 2) * 9}deg`, marginLeft: i ? -14 : 0 }}
      />
    ));
  const scene =
    power === 'peekOwn' ? (
      <MiniHand peek={1} tag={t('rc_you')} />
    ) : power === 'peekOther' ? (
      <MiniHand peek={2} tag={t('rc_other')} />
    ) : power === 'blindSwap' ? (
      <>
        <MiniHand swap="R" tag={t('rc_you')} />
        <MiniHand swap="L" tag={t('rc_other')} />
      </>
    ) : (
      <>
        <MiniHand peek={1} tag={t('rc_other')} />
        <MiniHand swap="R" tag={t('rc_you')} />
      </>
    );
  return (
    <div className="rc-row">
      <div className="rc-fan">{fan}</div>
      {scene}
    </div>
  );
}

function QuickArt({ r }: { r: RuleSet }) {
  return (
    <div className="rc-row">
      <div className="rc-col">
        <Pic c={card('6', 'H')} style={{ rotate: '-6deg' }} />
        <Tag tone="g">{t('rc_same')}</Tag>
      </div>
      <Pic c={card('6', 'C')} anim="throw" />
      {r.quickDiscard.penaltyCards > 0 ? (
        <div className="rc-col">
          <Pic c={null} anim="drop" />
          <Tag tone="b">{t('rc_penalty')}</Tag>
        </div>
      ) : null}
    </div>
  );
}

function TamalouArt({ r }: { r: RuleSet }) {
  return (
    <div className="rc-row">
      <Tag tone="b" style={{ fontSize: '1.3rem', padding: '6px 14px' }}>
        {t('actCall')}
      </Tag>
      <div className="grid rc-mini" style={{ '--cols': 2 } as CSSProperties}>
        {[0, 1, 2, 3].map((i) => (
          <Pic key={i} c={null} badge={r.tamalou.lockCallerCards ? LOCK : null} tone="b" />
        ))}
      </div>
      <Tag>{t('rc_lastTurn')}</Tag>
    </div>
  );
}

function EndArt({ r }: { r: RuleSet }) {
  const g = r.gameEnd;
  if (g.mode === 'rounds') {
    return (
      <div className="rc-row">
        {Array.from({ length: Math.min(g.rounds, 10) }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed picture
          <span key={i} className="rc-dot" />
        ))}
        <Tag>{t('rc_rounds', { n: g.rounds })}</Tag>
      </div>
    );
  }
  return (
    <div className="rc-meter">
      <span className="rc-meter-fill" />
      <span className="rc-meter-mark" />
      <Tag tone="b" style={{ position: 'absolute', right: 0, top: -34 }}>
        {t('rc_out', { n: g.threshold })}
      </Tag>
    </div>
  );
}

function PaceArt() {
  return (
    <div className="rc-row">
      <svg className="rc-clock" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5l3 2" />
      </svg>
    </div>
  );
}

export function slidesFor(r: RuleSet): Slide[] {
  const sections = summarize(r);
  const sec = (title: string) => sections.find((s) => s.title === title)?.lines ?? [];
  const plain = (text: string): SummaryLine => ({ text, changed: false });
  const powerLines = sec('sec_powers');
  const groups = powerGroups(r);
  const powersChanged = !same(r.powers.byRank, DEFAULT_RULES.powers.byRank);
  const activation = powerLines.at(-2);
  const mustSwap = powerLines.at(-1);
  const slides: Slide[] = [
    { key: 'hand', title: t('rc_hand'), lines: [plain(t('rc_handText')), ...sec('sec_hand')], art: <HandArt r={r} /> },
    {
      key: 'turn',
      title: t('rc_turn'),
      lines: [plain(t('rc_turnText')), ...(mustSwap ? [mustSwap] : [])],
      art: <TurnArt />,
    },
    {
      key: 'values',
      title: t('rc_values'),
      lines: [...sec('sec_values'), ...sec('sec_deck')],
      art: <ValuesArt r={r} />,
    },
    ...(groups.length === 0
      ? [{ key: 'powers', title: t('rc_noPowers'), lines: powerLines, art: <PaceArt /> }]
      : groups.map(([power, ranks]) => ({
          key: `power-${power}`,
          title: t('rc_power', { ranks: ranks.map((rank) => rankName({ rank })).join(', ') }),
          lines: [{ text: powerLine(power, ranks), changed: powersChanged }, ...(activation ? [activation] : [])],
          art: <PowerArt power={power} ranks={ranks} />,
        }))),
    {
      key: 'quick',
      title: t('rc_quick'),
      lines: [...(r.quickDiscard.enabled ? [plain(t('rc_quickText'))] : []), ...sec('sec_quick')],
      art: <QuickArt r={r} />,
    },
    {
      key: 'tamalou',
      title: t('rc_tamalou'),
      lines: [plain(t('rc_tamalouText')), ...sec('sec_tamalou')],
      art: <TamalouArt r={r} />,
    },
    { key: 'end', title: t('rc_end'), lines: sec('sec_end'), art: <EndArt r={r} /> },
    { key: 'pace', title: t('rc_pace'), lines: sec('sec_pace'), art: <PaceArt /> },
  ];
  return slides;
}

/** The cards, side by side, swiped with a soft spring (the "physique souple" chosen for the table), or stepped. */
export function RulesCards({ rules }: { rules: RuleSet }) {
  // The hand's slide follows this device's hand layout: drawn again when it changes.
  const { hand } = useSettings();
  // biome-ignore lint/correctness/useExhaustiveDependencies: slidesFor reads the layout from the settings
  const slides = useMemo(() => slidesFor(rules), [rules, hand]);
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(0);
  const viewport = useRef<HTMLElement>(null);
  const x = useMotionValue(0);
  const reduced = useReducedMotion();
  const last = slides.length - 1;

  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: follow the width, not every index change
  useEffect(() => x.set(-index * width), [width]);

  const go = (i: number) => {
    const n = Math.max(0, Math.min(last, i));
    setIndex(n);
    animate(x, -n * width, reduced ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 24 });
  };

  return (
    <div className="rc">
      <section className="rc-viewport" ref={viewport} aria-roledescription="carrousel" aria-label={t('editorTitle')}>
        <motion.div
          className="rc-track"
          style={{ x }}
          drag="x"
          dragConstraints={{ left: -last * width, right: 0 }}
          dragElastic={0.25}
          dragMomentum={false}
          onDragEnd={(_, info) => {
            // A flick carries further than the finger went, one card at most.
            const projected = x.get() + info.velocity.x * 0.16;
            go(Math.max(index - 1, Math.min(index + 1, Math.round(-projected / (width || 1)))));
          }}
        >
          {slides.map((s, i) => (
            <article
              key={s.key}
              className="rc-slide"
              aria-hidden={i !== index}
              aria-label={t('rc_goTo', { n: i + 1, title: s.title })}
            >
              <div className="rc-art">{s.art}</div>
              <h3>
                {s.title}
                {s.lines.some((l) => l.changed) ? <span className="tag">{t('editorChanged')}</span> : null}
              </h3>
              <ul>
                {s.lines.map((l) => (
                  <li key={l.text} className={l.changed ? 'changed' : undefined}>
                    {l.text}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </motion.div>
      </section>
      <div className="rc-dots">
        {slides.map((s, i) => (
          <button
            key={s.key}
            type="button"
            className={`rc-dotbtn${i === index ? ' on' : ''}`}
            aria-label={t('rc_goTo', { n: i + 1, title: s.title })}
            aria-current={i === index ? 'step' : undefined}
            onClick={() => go(i)}
          >
            <span />
          </button>
        ))}
      </div>
      <div className="rc-nav">
        <button type="button" className="btn btn-secondary" disabled={index === 0} onClick={() => go(index - 1)}>
          {t('rc_prev')}
        </button>
        <span className="mono rc-count" aria-live="polite">
          {t('rc_count', { n: index + 1, total: slides.length })}
        </span>
        <button type="button" className="btn btn-primary" onClick={() => go(index === last ? 0 : index + 1)}>
          {index === last ? t('rc_again') : t('rc_next')}
        </button>
      </div>
    </div>
  );
}
