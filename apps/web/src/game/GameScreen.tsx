import type { PlayerId, PlayerSeatView, PlayerView, SlotRef } from '@tamalou/shared';
import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, useEffect, useMemo, useReducer, useState } from 'react';
import { CardView } from '../cards/CardView.tsx';
import type { GameConnection } from '../connection/types.ts';
import { updateSettings, useSettings } from '../feedback/settings.ts';
import { useFeedback } from '../feedback/useFeedback.ts';
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
  /** Absent when this player cannot start another game (online: only the game master can). */
  onReplay?: () => void;
  /** Online: shown above the table (a lost connection, a refused move). */
  banner?: ReactNode;
}

export function GameScreen({ conn, onQuit, onReplay, banner }: Props) {
  const view = useConnection(conn);
  const rules = conn.rules;
  const events = conn.events();
  const feedback = useFeedback(events, view.me);
  const settings = useSettings();
  const [pending, setPending] = useState<Pending>(NONE);
  const [showLog, setShowLog] = useState(false);
  const [showRules, setShowRules] = useState(false);
  /** Pass-and-play quick discard: choosing who claims, then that player's card. */
  const [claim, setClaim] = useState<'who' | PlayerId | null>(null);
  const ui = interaction(view, rules, pending);
  const handoff = conn.handoff?.() ?? null;

  // A selection that no longer applies (the turn moved on, the top card changed, the device changed hands) is dropped.
  const stepKey = `${view.me}:${view.phase}:${view.step}:${view.current}:${view.discardTop?.id}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on step change only
  useEffect(() => {
    setPending(NONE);
    setClaim(null);
  }, [stepKey]);

  // On a shared screen, a quick discard is claimed for a named player, from that player's own legal moves; their
  // cards stay face down on screen (their view is only used to know what they may claim).
  const claimers = conn.claimers?.() ?? null;
  const claimUi =
    claim && claim !== 'who' && conn.viewOf ? interaction(conn.viewOf(claim), rules, { kind: 'quick' }) : null;
  const canClaim = (seat: PlayerId) =>
    !!conn.viewOf &&
    interaction(conn.viewOf(seat), rules, NONE).legal.some(
      (a) => a.type === 'quickDiscard' && a.target.player === seat,
    );
  const whoCanClaim = claimers && view.quickDiscardOpen ? claimers.filter(canClaim) : [];

  const names = useMemo(() => new Map(view.players.map((p) => [p.id, p.name])), [view.players]);
  const nameOf = (id: PlayerId) => names.get(id) ?? id;
  const me = view.players.find((p) => p.id === view.me);
  const opponents = view.players.filter((p) => p.id !== view.me);

  const touch = (ref: SlotRef) => {
    if (claim && claim !== 'who' && claimUi) {
      const c = claimUi.slot(ref);
      if (c?.send) conn.send(c.send);
      setClaim(null);
      return;
    }
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

  const lines = events.map((e) => describeEvent(e, nameOf, view.me)).filter((l): l is string => l !== null);

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
          const claimAction = claimUi && p.id === claim ? claimUi.slot(ref) : null;
          const action = claim ? (claimAction?.send ? claimAction : null) : ui.slot(ref);
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
              flash={feedback.flash.has(`${p.id}:${s.slot}`)}
              selected={ui.selected(ref)}
              onSelect={action ? () => touch(ref) : undefined}
            />
          );
        })}
      </fieldset>
    );
  };

  const myTurn = view.current === view.me;
  const prompt =
    claim === 'who'
      ? t('promptQuickWho')
      : claim
        ? t('promptQuickAs', { name: nameOf(claim) })
        : promptFor(view, rules.hand.initialPeek.count, pending, conn.drawPending(), nameOf);

  if (handoff) {
    return (
      <HandoffCover
        name={handoff.name}
        onReveal={() => conn.reveal?.()}
        onQuit={() => (window.confirm(t('confirmQuit')) ? onQuit() : null)}
      />
    );
  }

  return (
    <div className="game">
      <header className="game-bar">
        <button type="button" className="ghost" onClick={() => (window.confirm(t('confirmQuit')) ? onQuit() : null)}>
          ← {t('actHome')}
        </button>
        <span className="mono round">{t('roundShort', { n: view.round })}</span>
        <span className="bar-actions">
          <button
            type="button"
            className="ghost"
            aria-label={t(settings.sound ? 'soundOn' : 'soundOff')}
            onClick={() => updateSettings({ sound: !settings.sound })}
          >
            <span aria-hidden="true">{settings.sound ? '🔊' : '🔇'}</span>
          </button>
          <button type="button" className="ghost" onClick={() => setShowRules(true)}>
            {t('rules')}
          </button>
          <button type="button" className="ghost" aria-expanded={showLog} onClick={() => setShowLog((s) => !s)}>
            {t('journal')}
          </button>
        </span>
      </header>
      {banner}
      <p className="ticker" aria-hidden="true">
        {lines.at(-1) ?? '\u00a0'}
      </p>

      <section className="opponents" aria-label={t('opponents')}>
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
            <Presence state={conn.presence?.(p.id) ?? null} />
            {view.caller === p.id ? <span className="badge">Tamalou</span> : null}
            {seat(p, 'sm')}
          </div>
        ))}
      </section>

      <section className="center" aria-label={t('table')}>
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

      {me ? (
        <section className={`mine${myTurn ? ' seat-turn' : ''}`} aria-label={t('you')}>
          <div className="seat-head">
            <span className="seat-name">{me.name}</span>
            {view.caller === view.me ? <span className="badge">Tamalou</span> : null}
            <span className="mono seat-total">{plural('points', me.total)}</span>
          </div>
          {seat(me, 'lg')}
        </section>
      ) : (
        // A shared screen between two players: the whole table, every hand face down, in the opponents' row above.
        <section className="mine mine-empty" aria-label={t('table')} />
      )}

      <footer className="controls">
        <p className="prompt" aria-live="polite">
          {prompt}
        </p>
        <div className="buttons">
          {claim === 'who' ? (
            whoCanClaim.map((id) => (
              <button key={id} type="button" className="btn btn-secondary" onClick={() => setClaim(id)}>
                {nameOf(id)}
              </button>
            ))
          ) : claim ? null : (
            <>
              {buttons(ui, pending, view, rules.hand.initialPeek.count, send, setPending, !!claimers)}
              {pending.kind === 'none' && whoCanClaim.length > 0 ? (
                <button type="button" className="btn btn-secondary" onClick={() => setClaim('who')}>
                  ⚡ {t('actQuick')}
                </button>
              ) : null}
            </>
          )}
          {claim ? (
            <button type="button" className="btn btn-secondary" onClick={() => setClaim(null)}>
              {t('actCancel')}
            </button>
          ) : null}
        </div>
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

      <AnimatePresence>
        {feedback.splash ? (
          <motion.div
            key="splash"
            className="splash"
            role="status"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.15, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 18 }}
          >
            <strong>{t('splashTamalou')}</strong>
            <span>
              {feedback.splash === view.me ? t('splashByYou') : t('splashBy', { name: nameOf(feedback.splash) })}
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {view.phase === 'roundOver' || view.phase === 'gameOver' ? (
        <RoundOver view={view} conn={conn} nameOf={nameOf} onQuit={onQuit} onReplay={onReplay} />
      ) : null}
    </div>
  );
}

/** A seat whose player lost the connection, or whose bot plays in their place (online). */
function Presence({ state }: { state: 'offline' | 'away' | null }) {
  if (!state) return null;
  return <span className="presence">{t(state === 'away' ? 'presence_away' : 'presence_offline')}</span>;
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
  const seated = view.players.some((p) => p.id === view.me);
  if (view.phase === 'initialPeek') {
    if (!seated || view.ready.includes(view.me)) return t('promptWaitOthers');
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
  /** A shared screen offers the quick discard per player instead (pass-and-play). */
  shared = false,
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
  if (ui.canQuick && !shared) btn('quick', `⚡ ${t('actQuick')}`, () => setPending({ kind: 'quick' }));
  return out;
}

/**
 * Between two players on one device (docs/SPEC.md §5.2): nothing of the game is drawn, only who to pass the device to,
 * so the player handing it over cannot see the next one's cards and the next one cannot see the last one's.
 */
function HandoffCover({ name, onReveal, onQuit }: { name: string; onReveal: () => void; onQuit: () => void }) {
  return (
    <main className="handoff">
      <button type="button" className="ghost handoff-quit" onClick={onQuit}>
        ← {t('actHome')}
      </button>
      <div className="handoff-card" aria-hidden="true">
        <span>T</span>
      </div>
      <h1>{t('handoffTitle', { name })}</h1>
      <p className="muted">{t('handoffHint', { name })}</p>
      <button type="button" className="btn btn-primary btn-big" onClick={onReveal} ref={(el) => el?.focus()}>
        {t('handoffReveal', { name })}
      </button>
    </main>
  );
}
