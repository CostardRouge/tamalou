import type { PlayerId } from '@tamalou/shared';

// Pass-and-play (docs/SPEC.md §5.2): one device, several players. The screen shows one player's private view only
// after the device has been handed to them; in between, a cover says who to pass it to and shows nothing. While no
// human has anything to do (bots playing, a round ending), the screen shows the table as a spectator would.

/** The id under which a shared screen asks for a view: a seat that is no player, so it sees only public cards. */
export const SPECTATOR = '@table';

export class Handoff {
  /** The player whose private view is on screen; null: the public table. */
  private shownSeat: PlayerId | null = null;
  /** The player the device must go to before anything private is shown. */
  private pendingSeat: PlayerId | null = null;

  /** Follows who the game waits for; idempotent, so it can be called on every read. */
  update(wanted: PlayerId | null): void {
    if (wanted === null) {
      this.shownSeat = null;
      this.pendingSeat = null;
    } else if (wanted !== this.shownSeat) {
      // Someone else's turn: hide the previous player's view at once, then wait for the tap.
      this.shownSeat = null;
      this.pendingSeat = wanted;
    } else {
      this.pendingSeat = null;
    }
  }

  /** The player tapped "c'est moi": their view may be shown. */
  reveal(): void {
    if (this.pendingSeat === null) return;
    this.shownSeat = this.pendingSeat;
    this.pendingSeat = null;
  }

  get shown(): PlayerId | null {
    return this.shownSeat;
  }

  get pending(): PlayerId | null {
    return this.pendingSeat;
  }

  /** The seat whose view the screen shows: a player once revealed, else the spectator. */
  get viewer(): PlayerId {
    return this.shownSeat ?? SPECTATOR;
  }
}
