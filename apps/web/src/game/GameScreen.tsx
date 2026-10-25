import type { Action, Card, PlayerId, PlayerSeatView, PlayerView, SlotRef } from '@tamalou/shared';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { CardView } from '../cards/CardView.tsx';
import type { GameConnection } from '../connection/types.ts';
import { getSettings, updateSettings, useSettings } from '../feedback/settings.ts';
import { useFeedback } from '../feedback/useFeedback.ts';
import { tableSeats } from '../home/table.ts';
import { cardName, plural, t } from '../i18n/index.ts';
import { RulesPanel } from '../rules/RulesSummary.tsx';
import { type Act, ActionBar } from './ActionBar.tsx';
import { confirmQuestion } from './confirm.ts';
import { Draggable, measurePlaces } from './Draggable.tsx';
import { DrawStage } from './DrawStage.tsx';
import { type DragSource, type Drop, dropsFor, MY_ZONE, resolveDrop } from './drag.ts';
import { noteDrop, useFlights } from './FlightLayer.tsx';
import { FrontCard } from './FrontCard.tsx';
import { dealToReplay, type Place, slotPlace } from './flights.ts';
import { facing } from './front.ts';
import { HandPicker } from './HandPicker.tsx';
import { HandWatch } from './HandWatch.tsx';
import { handFrame, opponentLayout, slotStyle } from './hand.ts';
import { interaction, NONE, type Pending } from './interaction.ts';
import { describeEvent } from './log.ts';
import { Overlay } from './Overlay.tsx';
import { handKind, PACE_FACTOR, SPEED_FACTOR } from './pace.ts';
import { RevealStage } from './RevealStage.tsx';
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
  const reduced = useReducedMotion();
  // The cards are dealt on this table, from the deck to every hand: the game is already there when the deal ends.
  const [replayFrom] = useState(() => dealToReplay(events));
  const settings = useSettings();
  const currentRef = useRef(view.current);
  currentRef.current = view.current;
  // The others' moves played by their hand (game/pace.ts): a named cursor with a mouse, a fingertip on a touch screen.
  const [handKindHere] = useState(handKind);
  const colorOf = (id: PlayerId) =>
    `var(--seat-${
      (Math.max(
        0,
        view.players.filter((p) => p.id !== view.me).findIndex((p) => p.id === id),
      ) %
        5) +
      1
    })`;
  const fly = useFlights(events, view.me, !reduced, {
    replayFrom,
    handOf: (id) => view.players.find((p) => p.id === id)?.slots.length ?? 4,
    hands: settings.showHands
      ? {
          kind: handKindHere,
          name: (id) => view.players.find((p) => p.id === id)?.name ?? id,
          color: colorOf,
          current: () => currentRef.current,
        }
      : null,
    speed: SPEED_FACTOR[settings.cardSpeed],
    pace: PACE_FACTOR[settings.botPace],
  });
  // The bots this device hosts follow its pace, changed mid-game too (from their next move).
  useEffect(() => conn.setBotPace?.(PACE_FACTOR[settings.botPace]), [conn, settings.botPace]);
  const [pending, setPending] = useState<Pending>(NONE);
  const lastDrawn = useRef<{ holder: PlayerId; card: Card | null } | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showDisplay, setShowDisplay] = useState(false);
  /** Pass-and-play quick discard: choosing who claims, then that player's card. */
  const [claim, setClaim] = useState<'who' | PlayerId | null>(null);
  /** A move waiting for "Confirmer" when the game master asks to confirm every move (rules.assist.confirmMoves). */
  const [staged, setStaged] = useState<{
    action: Action;
    ref: SlotRef | null;
    question: string;
    after?: () => void;
  } | null>(null);
  /** A card being carried by hand: where it may land, and where it would land now. */
  const [drag, setDrag] = useState<{ drops: Drop[]; hot: Place[] } | null>(null);
  /** A drop that could mean two things, waiting for the player's answer. */
  const [ask, setAsk] = useState<Drop[] | null>(null);
  /** The second half of a drop: a card drawn onto one of mine is swapped there once the draw is through. */
  const [queued, setQueued] = useState<Action | null>(null);
  const ui = interaction(view, rules, pending);
  const handoff = conn.handoff?.() ?? null;

  // A selection that no longer applies (the turn moved on, the top card changed, the device changed hands) is dropped.
  const stepKey = `${view.me}:${view.phase}:${view.step}:${view.current}:${view.discardTop?.id}`;
  // The discard shows the top from before the cards still on their way to it (another player's hand has not put them
  // down yet): the tops it had, newest last, read back by how many are inbound. A round starts on an empty pile: the
  // deal's last card lays its first card (the owner, 2026-10-25), so the pile stays empty until that card lands.
  const discardTops = useRef<{ round: number; tops: (typeof view.discardTop)[] }>({ round: 0, tops: [] });
  if (discardTops.current.round !== view.round) discardTops.current = { round: view.round, tops: [null] };
  if (discardTops.current.tops.at(-1)?.id !== view.discardTop?.id) {
    discardTops.current.tops = [...discardTops.current.tops.slice(-8), view.discardTop];
  }
  const tops = discardTops.current.tops;
  const shownDiscard = tops[Math.max(0, tops.length - 1 - fly.inbound('discard'))] ?? null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on step change only
  useEffect(() => {
    setPending(NONE);
    setClaim(null);
    setStaged(null);
    setAsk(null);
  }, [stepKey]);

  // The others' card backs face them (game/front.ts): each seat says which way, from where it sits now.
  useLayoutEffect(() => {
    const turn = () => {
      const middle = document.querySelector('.center')?.getBoundingClientRect();
      if (!middle) return;
      const m = { x: middle.left, y: middle.top, w: middle.width, h: middle.height };
      for (const el of document.querySelectorAll<HTMLElement>('.opponents .seat')) {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--facing', `${facing({ x: r.left, y: r.top, w: r.width, h: r.height }, m)}deg`);
      }
    };
    turn();
    window.addEventListener('resize', turn);
    return () => window.removeEventListener('resize', turn);
  });

  // The spotlight: "À toi !" for a moment when my turn starts.
  const myTurnNow = view.phase === 'play' && view.current === view.me && !handoff;
  const [hello, setHello] = useState(false);
  useEffect(() => {
    setHello(myTurnNow);
    if (!myTurnNow) return;
    const id = window.setTimeout(() => setHello(false), 1400);
    return () => window.clearTimeout(id);
  }, [myTurnNow]);

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
  // Where each opponent sits round the table when the screen is wide enough to seat them (app.css, the wide table).
  const around = tableSeats(opponents.length);

  /** Sends a move, or stages it behind a question when every move is confirmed. */
  const go = (action: Action, ref: SlotRef | null, after?: () => void) => {
    const question = rules.assist.confirmMoves ? confirmQuestion(action, view, nameOf) : null;
    if (question) {
      setStaged({ action, ref, question, ...(after ? { after } : {}) });
      return;
    }
    conn.send(action);
    after?.();
  };
  const confirmStaged = () => {
    if (!staged) return;
    conn.send(staged.action);
    staged.after?.();
    setStaged(null);
    setPending(NONE);
  };
  const touch = (ref: SlotRef) => {
    if (claim && claim !== 'who' && claimUi) {
      const c = claimUi.slot(ref);
      if (c?.send) go(c.send, ref, () => setClaim(null));
      else setClaim(null);
      return;
    }
    const a = ui.slot(ref);
    if (!a) return;
    if (a.next) setPending(a.next);
    if (a.send) go(a.send, ref, () => setPending(NONE));
  };
  const send = (a: Parameters<GameConnection['send']>[0] | undefined) => {
    if (!a) return;
    go(a, null, () => setPending(NONE));
  };

  const lines = events.map((e) => describeEvent(e, nameOf, view.me)).filter((l): l is string => l !== null);

  // By hand (design D): a card picked up shows where it may land; let go, it plays that move, or asks when the drop
  // could mean two things; dropped nowhere, it springs back.
  const perform = (d: Drop) => {
    setAsk(null);
    if (d.followUp) setQueued(d.followUp);
    go(d.send, null, () => setPending(NONE));
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: checked after every render, like the queue it serves
  useEffect(() => {
    if (queued?.type !== 'swap') return;
    const swap = ui.find('swap', (a) => a.slot === queued.slot);
    if (swap) {
      setQueued(null);
      go(swap, { player: view.me, slot: queued.slot });
    } else if (view.current !== view.me || view.phase !== 'play') setQueued(null);
  });
  const handsFree = pending.kind === 'none' && !staged && !claim && !ask;
  const carry = (source: DragSource, place: Place, child: ReactNode) => {
    const drops = handsFree ? dropsFor(source, ui, view) : [];
    return (
      <Draggable
        enabled={drops.length > 0}
        onPick={() => {
          setDrag({ drops, hot: [] });
          buzz(8);
        }}
        onMove={(point) => {
          const hot = resolveDrop(drops, measurePlaces(), point, { x: 0, y: 0 }).map((d) => d.place);
          setDrag((d) => (d && d.hot.join() === hot.join() ? d : { drops, hot }));
        }}
        onRelease={(point, velocity, box) => {
          setDrag(null);
          const found = resolveDrop(drops, measurePlaces(), point, velocity);
          const [only] = found;
          if (!only) return false;
          if (found.length > 1) {
            setAsk(found);
            return false;
          }
          buzz(15);
          perform(only);
          // A drop that only starts a move (drawing onto one of my cards) lets the card spring back to the deck: the
          // drawn card then flies from there. Any other move goes on from where the card was let go.
          if (only.followUp) return false;
          noteDrop(place, box);
          return true;
        }}
      >
        {child}
      </Draggable>
    );
  };
  const mark = (place: Place) =>
    drag?.hot.includes(place) ? 'hot' : drag?.drops.some((d) => d.place === place) ? 'drop' : undefined;

  // The hand's layout is this device's choice (game/hand.ts); an opponent's seat follows it unless told otherwise.
  const seat = (p: PlayerSeatView, size: 'sm' | 'lg') => {
    const mine = p.id === view.me;
    const layout = mine ? settings.hand : opponentLayout(settings.hand, settings.oppHand);
    const frame = handFrame(layout, p.slots.length, rules.hand.columns, !mine);
    return (
      <fieldset className={frame.className} style={frame.style} aria-label={mine ? t('you') : p.name}>
        {p.slots.map((s, i) => {
          const ref = { player: p.id, slot: s.slot };
          const claimAction = claimUi && p.id === claim ? claimUi.slot(ref) : null;
          const action = claim ? (claimAction?.send ? claimAction : null) : ui.slot(ref);
          const label = !s.filled
            ? t('slotEmpty')
            : `${mine ? t('slotMine', { n: s.slot + 1 }) : t('slotOf', { n: s.slot + 1, name: p.name })}, ${
                s.card ? cardName(s.card) : t('cardHidden')
              }${s.locked ? `, ${t('locked')}` : ''}`;
          const place = slotPlace(ref);
          return (
            <div key={s.slot} className="slot" style={slotStyle(i, p.slots.length)}>
              {carry(
                { kind: 'slot', ref },
                place,
                <CardView
                  place={place}
                  mark={mark(place)}
                  ghost={fly.landing.has(place)}
                  card={s.card}
                  label={label}
                  size={size}
                  empty={!s.filled}
                  locked={s.locked}
                  hint={action !== null}
                  flash={feedback.flash.has(`${p.id}:${s.slot}`)}
                  selected={ui.selected(ref) || (!!staged?.ref && sameRef(staged.ref, ref))}
                  onSelect={action ? () => touch(ref) : undefined}
                />,
              )}
            </div>
          );
        })}
      </fieldset>
    );
  };

  const myTurn = view.current === view.me;
  // The quick discard, by hand (the owner's pick, 2026-10-22): while another player's discard is open and one of my
  // cards may go on it, the discard glows and says so, my cards lift to be taken, and the bolt is only a second way.
  // On my own turn too, until I draw (my draw closes it: 2026-10-25, the owner had missed it there). A shared screen
  // keeps its "who claims" button: the cards there are not the holder's to drag.
  const quickOpen =
    view.phase === 'play' &&
    view.quickDiscardOpen &&
    (!myTurn || view.step === 'draw') &&
    ui.canQuick &&
    handsFree &&
    !claimers;
  const throwing = !!drag?.drops.some((d) => d.place === 'discard' && d.send.type === 'quickDiscard');
  const prompt = staged
    ? staged.question
    : claim === 'who'
      ? t('promptQuickWho')
      : claim
        ? t('promptQuickAs', { name: nameOf(claim) })
        : quickOpen && !myTurn
          ? t('promptQuickOpen')
          : promptFor(view, rules.hand.initialPeek.count, pending, conn.drawPending(), nameOf);

  // The spotlight (design B of "lisibilité du tour"): whose turn glows; while I choose, what I cannot touch fades.
  // A card a power lets me look at, shown large in front of me (RevealStage).
  const looking =
    view.step === 'reveal' && view.current === view.me && view.reveal?.player === view.me && view.reveal.card
      ? { target: view.reveal.target, card: view.reveal.card }
      : null;
  const choosing =
    !!staged ||
    pending.kind !== 'none' ||
    (myTurn && view.phase === 'play' && (view.step === 'draw' || view.step === 'place' || view.step === 'power'));
  const spot = view.phase === 'play' ? (myTurn ? ' turn-mine' : ' turn-other') : '';
  // The drawn card (game/front.ts): in front of whoever drew it, mine held above my hand or large on the table.
  const holder = view.drawn ? view.current : null;
  const holdingMine = !!holder && holder === view.me && !!me;
  // Another player's card stays in front of them until their hand has taken it on, the state may have moved on.
  if (view.drawn && holder) lastDrawn.current = { holder, card: view.drawn.card };
  const front =
    holder && !holdingMine && view.drawn
      ? { holder, card: view.drawn.card }
      : !holder && lastDrawn.current && lastDrawn.current.holder !== view.me && fly.waiting('drawn')
        ? lastDrawn.current
        : null;
  const big = holdingMine && settings.drawView === 'big';
  const drawnCard = view.drawn
    ? carry(
        { kind: 'drawn' },
        'drawn',
        <CardView
          card={view.drawn.card}
          place="drawn"
          ghost={fly.landing.has('drawn')}
          label={`${t('drawn')}${view.drawn.card ? ` : ${cardName(view.drawn.card)}` : ''}`}
          size="lg"
        />,
      )
    : null;

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
    // More than three opponents wrap onto a second row on a phone: the cards make room for it (app.css, --opp-rows).
    <div
      className={`game${opponents.length > 3 ? ' game-crowded' : ''}${spot}${choosing ? ' choosing' : ''}${drag ? ' dragging' : ''}${quickOpen || throwing ? ' quick-open' : ''}${looking ? ' revealing' : ''}${big ? ' drawing-big' : ''}`}
      style={{ '--opp-rows': opponents.length > 3 ? 2 : 1 } as CSSProperties}
    >
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
          <button type="button" className="ghost" aria-label={t('display')} onClick={() => setShowDisplay(true)}>
            <svg className="bar-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
              <circle cx="15" cy="7" r="2" />
              <circle cx="9" cy="17" r="2" />
            </svg>
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
        {opponents.map((p, i) => (
          <div
            key={p.id}
            data-seat={p.id}
            className={`seat${view.current === p.id ? ' seat-turn' : ''}${p.eliminated ? ' seat-out' : ''}`}
            style={{ '--sx': `${around[i]?.x ?? 50}%`, '--sy': `${around[i]?.y ?? 20}%` } as CSSProperties}
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
          {carry(
            { kind: 'deck' },
            'deck',
            <CardView
              card={null}
              place="deck"
              label={plural('deckCount', view.deckSize)}
              size="md"
              hint={!!ui.find('draw', (a) => a.from === 'deck')}
              onSelect={
                ui.find('draw', (a) => a.from === 'deck')
                  ? () => send(ui.find('draw', (a) => a.from === 'deck'))
                  : undefined
              }
            />,
          )}
          <span className="pile-label mono">{view.deckSize}</span>
        </div>
        <div className="pile pile-discard">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={shownDiscard?.id ?? 'empty'}
              initial={{ y: -24, opacity: 0, rotate: -6 }}
              animate={{ y: 0, opacity: 1, rotate: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              {carry(
                { kind: 'discard' },
                'discard',
                <CardView
                  card={shownDiscard}
                  place="discard"
                  mark={mark('discard')}
                  // Not ghosted: the top from before stays in sight until the inbound card lands on it.
                  empty={!shownDiscard}
                  label={shownDiscard ? `${t('discard')} : ${cardName(shownDiscard)}` : t('discardEmpty')}
                  size="md"
                  hint={!!ui.find('draw', (a) => a.from === 'discard')}
                  onSelect={
                    ui.find('draw', (a) => a.from === 'discard')
                      ? () => send(ui.find('draw', (a) => a.from === 'discard'))
                      : undefined
                  }
                />,
              )}
            </motion.div>
          </AnimatePresence>
          {quickOpen || throwing ? (
            <span className="pile-label drop-hint" aria-hidden="true">
              {t(drag?.hot.includes('discard') ? 'dropHintHot' : 'dropHint')}
            </span>
          ) : (
            <span className={`pile-label${view.quickDiscardOpen ? ' open' : ''}`}>{t('discard')}</span>
          )}
        </div>
      </section>

      {me ? (
        <section
          className={`mine${myTurn ? ' seat-turn' : ''}${drag?.hot.includes(MY_ZONE) ? ' zone-hot' : ''}`}
          aria-label={t('you')}
          data-seat={view.me}
          data-zone="mine"
        >
          <div className="seat-head">
            <span className="seat-name">{me.name}</span>
            {view.caller === view.me ? <span className="badge">Tamalou</span> : null}
            <span className="mono seat-total">{plural('points', me.total)}</span>
          </div>
          {seat(me, 'lg')}
          {holdingMine && !big ? (
            <div className="held drawn">
              {drawnCard}
              <span className="held-label">{t('drawnHeld')}</span>
            </div>
          ) : null}
        </section>
      ) : (
        // A shared screen between two players: the whole table, every hand face down, in the opponents' row above.
        <section className="mine mine-empty" aria-label={t('table')} />
      )}

      <footer className="controls">
        <p className="prompt" aria-live="polite">
          {prompt}
        </p>
        <ActionBar
          acts={
            staged
              ? [
                  {
                    key: 'confirm',
                    label: t('actConfirm'),
                    icon: 'keep',
                    tone: staged.action.type === 'callTamalou' ? 'call' : 'primary',
                    main: true,
                    onClick: confirmStaged,
                  },
                  cancelAct(() => setStaged(null)),
                ]
              : claim === 'who'
                ? [
                    ...whoCanClaim.map((id): Act => ({ key: id, label: nameOf(id), onClick: () => setClaim(id) })),
                    cancelAct(() => setClaim(null)),
                  ]
                : claim
                  ? [cancelAct(() => setClaim(null))]
                  : [
                      ...actsFor(ui, pending, view, rules.hand.initialPeek.count, send, setPending, !!claimers),
                      ...(pending.kind === 'none' && whoCanClaim.length > 0
                        ? [quickAct(() => setClaim('who'), false)]
                        : []),
                    ]
          }
          hint={quickOpen && !myTurn ? t('quickBarHint') : null}
        />
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

      {showDisplay ? (
        // At the top, over the opponents: my hand stays in sight and changes as the player picks.
        <Overlay className="overlay-top" labelledBy="display-title" onClose={() => setShowDisplay(false)}>
          <div className="panel">
            <div className="panel-head">
              <h2 id="display-title">{t('display')}</h2>
              <button type="button" className="ghost" onClick={() => setShowDisplay(false)} ref={(el) => el?.focus()}>
                {t('close')}
              </button>
            </div>
            <HandPicker name="hand-table" />
            <HandWatch name="watch-table" />
          </div>
        </Overlay>
      ) : null}

      <AnimatePresence>
        {hello ? (
          <motion.div
            key="hello"
            className="turn-banner"
            aria-hidden="true"
            initial={{ y: -24, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
          >
            {t('turnBanner')}
          </motion.div>
        ) : null}
      </AnimatePresence>

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

      {looking ? (
        <RevealStage
          key={`${looking.target.player}:${looking.target.slot}:${looking.card.id}`}
          card={looking.card}
          place={slotPlace(looking.target)}
          caption={
            looking.target.player === view.me
              ? t('slotMine', { n: looking.target.slot + 1 })
              : t('slotOf', { n: looking.target.slot + 1, name: nameOf(looking.target.player) })
          }
        />
      ) : null}
      {front ? (
        <FrontCard
          holder={front.holder}
          name={nameOf(front.holder)}
          named={!settings.showHands}
          color={colorOf(front.holder)}
          card={front.card}
          label={`${t('drawnBy', { name: nameOf(front.holder) })}${front.card ? ` : ${cardName(front.card)}` : ''}`}
          ghost={fly.landing.has('drawn')}
        />
      ) : null}
      {big && view.drawn ? (
        <DrawStage caption={view.drawn.card ? t('drawnCaption', { card: cardName(view.drawn.card) }) : t('drawn')}>
          {drawnCard}
        </DrawStage>
      ) : null}
      {fly.layer}

      {ask ? (
        <div className="ask" role="dialog" aria-modal="true" aria-labelledby="ask-title">
          <h2 id="ask-title">{t('dropAsk')}</h2>
          {ask.map((d) => (
            <button key={d.place} type="button" className="btn btn-secondary" onClick={() => perform(d)}>
              {t(d.label.key, { n: d.label.n ?? '', name: d.label.player ? nameOf(d.label.player) : '' })}
            </button>
          ))}
          <button type="button" className="btn" onClick={() => setAsk(null)}>
            {t('actCancel')}
          </button>
        </div>
      ) : null}

      {view.phase === 'roundOver' || view.phase === 'gameOver' ? (
        <RoundOver view={view} conn={conn} nameOf={nameOf} onQuit={onQuit} onReplay={onReplay} />
      ) : null}
    </div>
  );
}

const sameRef = (a: SlotRef, b: SlotRef) => a.player === b.player && a.slot === b.slot;

/** A short tick under the finger when a card is picked up or taken, if the player wants vibrations. */
function buzz(ms: number) {
  if (getSettings().haptics) navigator.vibrate?.(ms);
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

const cancelAct = (onClick: () => void): Act => ({
  key: 'cancel',
  label: t('actCancel'),
  caption: t('barCancel'),
  icon: 'cancel',
  onClick,
});

// The bolt is the second way to a quick discard (the first is dragging a card onto the open discard): never the wide
// button, even when it is the only thing to do while another player plays.
const quickAct = (onClick: () => void, on: boolean): Act => ({
  key: 'quick',
  label: t('actQuick'),
  caption: t('barQuick'),
  icon: 'quick',
  minor: true,
  on,
  onClick,
});

/** Everything the player can do now that is not a touch on a card, main action first. */
function actsFor(
  ui: ReturnType<typeof interaction>,
  pending: Pending,
  view: PlayerView,
  peekCount: number,
  send: (a: Parameters<GameConnection['send']>[0] | undefined) => void,
  setPending: (p: Pending) => void,
  /** A shared screen offers the quick discard per player instead (pass-and-play). */
  shared = false,
): Act[] {
  const out: Act[] = [];
  if (pending.kind !== 'none') {
    if (pending.kind === 'choosePeek' && pending.slots.length === peekCount) {
      const slots = pending.slots;
      out.push({
        key: 'peek',
        label: t('actConfirmPeek'),
        icon: 'look',
        tone: 'primary',
        main: true,
        onClick: () => send({ type: 'choosePeek', by: view.me, slots }),
      });
    }
    const skipPower = ui.find('skipPower');
    if (pending.kind === 'blindOwn' && skipPower) {
      out.push({
        key: 'skip',
        label: t('actSkipPower'),
        caption: t('barSkip'),
        icon: 'skip',
        onClick: () => send(skipPower),
      });
    }
    out.push(cancelAct(() => setPending(NONE)));
    return out;
  }
  const ready = ui.find('ready');
  if (ready) out.push({ key: 'ready', label: t('actReady'), tone: 'primary', main: true, onClick: () => send(ready) });
  const deck = ui.find('draw', (a) => a.from === 'deck');
  if (deck)
    out.push({
      key: 'deck',
      label: t('actDrawDeck'),
      icon: 'draw',
      tone: 'primary',
      main: true,
      onClick: () => send(deck),
    });
  const discard = ui.find('discardDrawn');
  if (discard) {
    out.push({
      key: 'discard',
      label: t('actDiscard'),
      icon: 'discard',
      tone: 'primary',
      main: true,
      onClick: () => send(discard),
    });
  }
  const end = ui.find('endReveal');
  if (end) out.push({ key: 'end', label: t('actEndReveal'), tone: 'primary', main: true, onClick: () => send(end) });
  const take = ui.find('draw', (a) => a.from === 'discard');
  if (take)
    out.push({
      key: 'take',
      label: t('actTakeDiscard'),
      caption: t('barTake'),
      icon: 'take',
      onClick: () => send(take),
    });
  const skip = ui.find('skipPower');
  if (skip)
    out.push({ key: 'skip', label: t('actSkipPower'), caption: t('barSkip'), icon: 'skip', onClick: () => send(skip) });
  const keep = ui.find('queenDecide', (a) => a.swapWith === null);
  if (keep)
    out.push({ key: 'keep', label: t('actKeep'), caption: t('barKeep'), icon: 'keep', onClick: () => send(keep) });
  const pass = ui.find('passCall');
  if (pass)
    out.push({ key: 'pass', label: t('actPass'), caption: t('barPass'), icon: 'pass', onClick: () => send(pass) });
  const call = ui.find('callTamalou');
  if (call)
    out.push({
      key: 'call',
      label: t('actCall'),
      caption: t('barCall'),
      icon: 'call',
      tone: 'call',
      onClick: () => send(call),
    });
  if (ui.canQuick && !shared) out.push(quickAct(() => setPending({ kind: 'quick' }), false));
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
