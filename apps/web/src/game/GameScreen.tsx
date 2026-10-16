import type { PlayerId, PlayerSeatView, PlayerView, SlotRef } from '@tamalou/shared';
import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, useEffect, useMemo, useReducer, useState } from 'react';
import { CardView } from '../cards/CardView.tsx';
import type { GameConnection } from '../connection/types.ts';
import { cardName, plural, t } from '../i18n/index.ts';
import { RulesPanel } from '../rules/RulesSummary.tsx';
import { interaction, NONE, type Pending } from './interaction.ts';
import { describeEvent } from './log.ts';
import { RoundOver } from './RoundOver.tsx';

// The table, portrait first (docs/SPEC.md §6): opponents on top, the piles in the middle, my grid at the bottom with
// the prompt and the buttons under my thumb. Everything shown comes from my view; every move from interaction().

export function useConnection(conn: GameConnection): PlayerView {
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => conn.subscribe(bump), [conn]);
  return conn.view();
}

interface Props {
  conn: GameConnection;
  onQuit: () => void;
  onReplay: () => void;
}

export function GameScreen({ conn, onQuit, onReplay }: Props) {
  const view = useConnection(conn);
  const rules = conn.rules;
  const [pending, setPending] = useState<Pending>(NONE);
  const [showLog, setShowLog] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const ui = interaction(view, rules, pending);

  // A selection that no longer applies (the turn moved on, the top card changed) is dropped.
  const stepKey = `${view.phase}:${view.step}:${view.current}:${view.discardTop?.id}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on step change only
  useEffect(() => setPending(NONE), [stepKey]);

  const names = useMemo(() => new Map(view.players.map((p) => [p.id, p.name])), [view.players]);
  const nameOf = (id: PlayerId) => names.get(id) ?? id;
  const me = view.players.find((p) => p.id === view.me);
  const opponents = view.players.filter((p) => p.id !== view.me);

  const touch = (ref: SlotRef) => {
    const a = ui.slot(ref);
    if (!a) return;
    if (a.next) setPending(a.next);
    if (a.send) {
      conn.send(a.send);
      setPending(NONE);
    }
  };
  const send = (a: Parameters<GameConnection['send']>[0] | undefined) => {
    if (!a) return;
    conn.send(a);
    setPending(NONE);
  };

  const lines = conn
    .events()
    .map((e) => describeEvent(e, nameOf, view.me))
    .filter((l): l is string => l !== null);

  const seat = (p: PlayerSeatView, size: 'sm' | 'lg') => {
    const mine = p.id === view.me;
    return (
      <fieldset
        className="grid"
        style={{ gridTemplateColumns: `repeat(${rules.hand.columns}, auto)` }}
        aria-label={mine ? t('you') : p.name}
      >
        {p.slots.map((s) => {
          const ref = { player: p.id, slot: s.slot };
          const action = ui.slot(ref);
          const label = !s.filled
            ? t('slotEmpty')
            : `${mine ? t('slotMine', { n: s.slot + 1 }) : t('slotOf', { n: s.slot + 1, name: p.name })}, ${
                s.card ? cardName(s.card) : t('cardHidden')
              }${s.locked ? `, ${t('locked')}` : ''}`;
          return (
            <CardView
              key={s.slot}
              card={s.card}
              label={label}
              size={size}
              empty={!s.filled}
              locked={s.locked}
              hint={action !== null}
              selected={ui.selected(ref)}
              onSelect={action ? () => touch(ref) : undefined}
            />
          );
        })}
      </fieldset>
    );
  };

  const myTurn = view.current === view.me;
  const prompt = promptFor(view, rules.hand.initialPeek.count, pending, conn.drawPending(), nameOf);

  return (
    <div className="game">
      <header className="game-bar">
        <button type="button" className="ghost" onClick={() => (window.confirm(t('confirmQuit')) ? onQuit() : null)}>
          ← {t('actHome')}
        </button>
        <span className="mono round">{t('roundShort', { n: view.round })}</span>
        <span className="bar-actions">
          <button type="button" className="ghost" onClick={() => setShowRules(true)}>
            {t('rules')}
          </button>
          <button type="button" className="ghost" aria-expanded={showLog} onClick={() => setShowLog((s) => !s)}>
            {t('journal')}
          </button>
        </span>
      </header>
      <p className="ticker" aria-hidden="true">
        {lines.at(-1) ?? '\u00a0'}
      </p>

      <section className="opponents" aria-label="Adversaires">
        {opponents.map((p) => (
          <div
            key={p.id}
            className={`seat${view.current === p.id ? ' seat-turn' : ''}${p.eliminated ? ' seat-out' : ''}`}
          >
            <div className="seat-head">
              <span className="seat-name">
                {view.current === p.id ? <span aria-hidden="true">▸ </span> : null}
                {p.name}
              </span>
              <span className="mono seat-total">{p.total}</span>
            </div>
            {view.caller === p.id ? <span className="badge">Tamalou</span> : null}
            {seat(p, 'sm')}
          </div>
        ))}
      </section>

      <section className="center" aria-label="Table">
        <div className="pile">
          <CardView
            card={null}
            label={plural('deckCount', view.deckSize)}
            size="md"
            hint={!!ui.find('draw', (a) => a.from === 'deck')}
            onSelect={
              ui.find('draw', (a) => a.from === 'deck')
                ? () => send(ui.find('draw', (a) => a.from === 'deck'))
                : undefined
            }
          />
          <span className="pile-label mono">{view.deckSize}</span>
        </div>
        <div className="pile">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={view.discardTop?.id ?? 'empty'}
              initial={{ y: -24, opacity: 0, rotate: -6 }}
              animate={{ y: 0, opacity: 1, rotate: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <CardView
                card={view.discardTop}
                empty={!view.discardTop}
                label={view.discardTop ? `${t('discard')} : ${cardName(view.discardTop)}` : t('discardEmpty')}
                size="md"
                hint={!!ui.find('draw', (a) => a.from === 'discard')}
                onSelect={
                  ui.find('draw', (a) => a.from === 'discard')
                    ? () => send(ui.find('draw', (a) => a.from === 'discard'))
                    : undefined
                }
              />
            </motion.div>
          </AnimatePresence>
          <span className={`pile-label${view.quickDiscardOpen ? ' open' : ''}`}>{t('discard')}</span>
        </div>
        <AnimatePresence>
          {view.drawn ? (
            <motion.div
              className="pile drawn"
              initial={{ scale: 0.6, opacity: 0, x: -40 }}
              animate={{ scale: 1, opacity: 1, x: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
            >
              <CardView
                card={view.drawn.card}
                label={`${t('drawn')}${view.drawn.card ? ` : ${cardName(view.drawn.card)}` : ''}`}
                size="lg"
              />
              <span className="pile-label">{myTurn ? t('drawn') : nameOf(view.current ?? '')}</span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </section>

      <section className={`mine${myTurn ? ' seat-turn' : ''}`} aria-label={t('you')}>
        <div className="seat-head">
          <span className="seat-name">{me?.name}</span>
          {view.caller === view.me ? <span className="badge">Tamalou</span> : null}
          <span className="mono seat-total">{plural('points', me?.total ?? 0)}</span>
        </div>
        {me ? seat(me, 'lg') : null}
      </section>

      <footer className="controls">
        <p className="prompt" aria-live="polite">
          {prompt}
        </p>
        <div className="buttons">{buttons(ui, pending, view, rules.hand.initialPeek.count, send, setPending)}</div>
      </footer>

      {showLog ? (
        <aside className="journal" aria-label={t('journal')}>
          <ol>
            {lines
              .slice(-30)
              .reverse()
              .map((l, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: the log only grows
                <li key={lines.length - i}>{l}</li>
              ))}
          </ol>
        </aside>
      ) : null}

      {showRules ? <RulesPanel rules={rules} onClose={() => setShowRules(false)} /> : null}

      {view.phase === 'roundOver' || view.phase === 'gameOver' ? (
        <RoundOver view={view} conn={conn} nameOf={nameOf} onQuit={onQuit} onReplay={onReplay} />
      ) : null}
    </div>
  );
}

function promptFor(
  view: PlayerView,
  peekCount: number,
  pending: Pending,
  drawPending: boolean,
  nameOf: (id: PlayerId) => string,
): string {
  if (pending.kind === 'quick') return t('promptQuick');
  if (pending.kind === 'quickGive') return t('promptQuickGive');
  if (pending.kind === 'blindOwn') return t('promptBlindSwapOther');
  if (view.phase === 'initialPeek') {
    if (view.ready.includes(view.me)) return t('promptWaitOthers');
    if (view.myPeekSlots === null) return plural('promptChoosePeek', peekCount);
    return plural('promptPeekInitial', view.myPeekSlots.length);
  }
  if (view.phase === 'roundEnding') return t('promptRoundEnding');
  if (view.phase !== 'play') return '';
  if (view.current !== view.me) return t('promptWaiting', { name: nameOf(view.current ?? '') });
  switch (view.step) {
    case 'draw':
      return drawPending ? t('promptDrawWaiting') : t('promptDraw');
    case 'place':
      return view.drawn?.from === 'discard' ? t('promptPlaceMustSwap') : t('promptPlace');
    case 'power':
      switch (view.pendingPower?.power) {
        case 'peekOwn':
          return t('promptPeekOwn');
        case 'peekOther':
          return t('promptPeekOther');
        case 'blindSwap':
          return t('promptBlindSwapOwn');
        default:
          return t('promptPeekThenSwap');
      }
    case 'reveal':
      return view.reveal?.power === 'peekThenSwap' ? t('promptQueen') : t('promptReveal');
    case 'callDecision':
      return t('promptCallDecision');
    default:
      return '';
  }
}

function buttons(
  ui: ReturnType<typeof interaction>,
  pending: Pending,
  view: PlayerView,
  peekCount: number,
  send: (a: Parameters<GameConnection['send']>[0] | undefined) => void,
  setPending: (p: Pending) => void,
) {
  const out: ReactNode[] = [];
  const btn = (key: string, label: string, onClick: () => void, kind: 'primary' | 'secondary' | 'call' = 'secondary') =>
    out.push(
      <button key={key} type="button" className={`btn btn-${kind}`} onClick={onClick}>
        {label}
      </button>,
    );

  if (pending.kind !== 'none') {
    if (pending.kind === 'choosePeek') {
      if (pending.slots.length === peekCount) {
        const slots = pending.slots;
        btn('peek', t('actConfirmPeek'), () => send({ type: 'choosePeek', by: view.me, slots }), 'primary');
      }
    }
    btn('cancel', t('actCancel'), () => setPending(NONE));
    const skipPower = ui.find('skipPower');
    if (pending.kind === 'blindOwn' && skipPower) btn('skip', t('actSkipPower'), () => send(skipPower));
    return out;
  }
  const ready = ui.find('ready');
  if (ready) btn('ready', t('actReady'), () => send(ready), 'primary');
  const deck = ui.find('draw', (a) => a.from === 'deck');
  if (deck) btn('deck', t('actDrawDeck'), () => send(deck), 'primary');
  const take = ui.find('draw', (a) => a.from === 'discard');
  if (take) btn('take', t('actTakeDiscard'), () => send(take));
  const discard = ui.find('discardDrawn');
  if (discard) btn('discard', t('actDiscard'), () => send(discard), 'primary');
  const skip = ui.find('skipPower');
  if (skip) btn('skip', t('actSkipPower'), () => send(skip));
  const end = ui.find('endReveal');
  if (end) btn('end', t('actEndReveal'), () => send(end), 'primary');
  const keep = ui.find('queenDecide', (a) => a.swapWith === null);
  if (keep) btn('keep', t('actKeep'), () => send(keep));
  const pass = ui.find('passCall');
  if (pass) btn('pass', t('actPass'), () => send(pass));
  const call = ui.find('callTamalou');
  if (call) btn('call', t('actCall'), () => send(call), 'call');
  if (ui.canQuick) btn('quick', `⚡ ${t('actQuick')}`, () => setPending({ kind: 'quick' }));
  return out;
}
