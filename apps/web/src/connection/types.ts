import type { Action, GameEvent, PlayerId, PlayerView, RuleSet } from '@tamalou/shared';

// What the UI talks to (docs/SPEC.md §4.3): the same interface whether the game runs in this browser
// (LocalConnection) or on a server (RemoteConnection, M6). The UI never sees anything but its seat's view and events.

export type SendResult = { ok: true; deferred?: boolean } | { ok: false; error: string };

export interface GameConnection {
  readonly me: PlayerId;
  readonly rules: RuleSet;
  view(): PlayerView;
  /** The events this seat received, oldest first. */
  events(): readonly GameEvent[];
  send(action: Action): SendResult;
  /** Ready for the next round. */
  continueRound(): void;
  /** Players who asked for the next round. */
  readyForNext(): PlayerId[];
  /** A draw waiting for the quick-discard window to run out. */
  drawPending(): boolean;
  /** Called after every change; returns the unsubscribe function. */
  subscribe(listener: () => void): () => void;
  dispose(): void;

  /** This device's pace for the bots it hosts (game/pace.ts); absent in a room, whose bots keep their own. */
  setBotPace?(factor: number): void;
  /** The screen is still showing moves: the bots this device hosts wait for it (Table.setShowing); absent in a room. */
  setShowing?(on: boolean): void;

  // Pass-and-play only (one device, several players): absent on a single player's connection.
  /** The player the device must be handed to before anything private is shown, if any. */
  handoff?(): { id: PlayerId; name: string } | null;
  /** That player has the device: show their view. */
  reveal?(): void;
  /** Players who may claim a quick discard from this shared screen. */
  claimers?(): PlayerId[];
  /** A player's own view, to work out their legal claims (never drawn on screen with its faces). */
  viewOf?(seat: PlayerId): PlayerView;

  // Rooms only (online, LAN).
  /** A human seat whose connection dropped (offline) or whose bot plays in their place (away). */
  presence?(seat: PlayerId): 'offline' | 'away' | null;
}
