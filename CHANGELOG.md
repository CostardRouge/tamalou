# Changelog

What each release of Tamalou brings to the people who play it. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html); `.github/workflows/release.yml` turns each section into a
tag and a GitHub Release once it reaches `main` (COMMON-PROJECT-SPEC C13, ADR-0019). Written in English, like the
code, though the game speaks French first. Codenames are French card words, in alphabetical order.

## [Unreleased]

### Added

- A rule for a Tamalou called on a tie with the lowest hand: made, now the default (no penalty), or missed, as
  before. It is in «Tamalou» when you customise the rules.
- A rule for a player left with no card: by default they now call Tamalou and the others play their last turn; the
  round can also end at once, or nothing happen, as before.

### Changed

- The home page's language link is now a small pill with a globe and the language's own name («English»,
  «Français») instead of «EN» / «FR».
- A hand closes up on the cards it still holds: the dashed places of thrown cards no longer show, nor lie over the
  cards left, and a player down to one card shows one card.
- Easy bots no longer call Tamalou on their first turns: they wait until they have played three, so a round leaves
  time to play.
- The journal's button at the top of the table is now a history clock, the same as the one beside the discard,
  instead of three lines that looked like a menu.
- On a phone, panels rising from the bottom (the end of a round, the rules…) now reach the screen's edges and its
  bottom, so they follow the phone's own rounded corners.
- Each set of rules offered before a game now reads as a short list: the number of cards, when a player is out, how
  the game ends, the cost of a failed Tamalou…, with the values in bold and what differs from Classique highlighted.

### Removed

- The «Rapide» bolt button in solo and online games: a quick discard is made by dragging a card onto the
  discard. Games on one shared device keep it, to say who claims.

### Fixed

- On a phone, the other players' seats no longer change size or jump to another row as they play: each keeps its
  place, and a long name gives way instead.
- The glow around the player whose turn it is is no longer cut off at the edges of the other players' area.
- The end-of-round panel can no longer leave you stuck: leaving the app while it shows no longer pauses the game
  behind it, the pause's «Reprendre» is never hidden under it, and it always offers «Quitter la partie», even while
  waiting for the others.
- Choosing a set of rules whose card is cut at the edge of its row now slides the card into full view (without
  animation for those who ask for less motion).
- On a computer, the panels rising from the bottom (setting up a game, the rules, the end of a round) now reach the
  bottom of the window, without a step underneath.
- At the end of a round, a player with no card left gets an empty place in their row, as on the table, instead of a
  shorter row.
- In the panel where you set up a game, only the middle scrolls now: the title and «Jouer» stay in place.

## [0.16.1] - 2026-11-25 — Piquet

### Fixed

- Changing a setting in a panel (Affichage, the settings, the rules…) no longer sends the panel back to its top: it
  stays where you scrolled.

## [0.16.0] - 2026-11-24 — Piquet

### Changed

- When another player takes the discard, the card in front of them now leans towards them, its face turned their
  way and slightly shaded, instead of rising towards you as a hidden card does; you can still read it.

## [0.15.0] - 2026-11-24 — Oudler

### Added

- The discard story: an icon beside the discard lays it out card by card, newest first, with who threw each one and
  how, the power played with it, and the cards taken back. The game master turns it on in the rules (Pace and help);
  it is off by default and on with the Beginner rules. Touching the discard itself still takes it.
- Choose how your cards look, under «Tes cartes» in the settings or «Affichage» at the table: the back's colour, its
  pattern, one or two letters or an emoji in its middle (or nothing), and an effect — an oil-slick iridescent sheen,
  or a holographic foil like a rare card that also shines on the court cards and jokers. Both stay still and shift
  only as you move the mouse or tilt the phone.
- Your profile: tap the greeting on the home screen («Bonjour …») to pick your name, one of eight colours and one of
  twelve icons. Your avatar shows on your seat and your hand, in a room's waiting list for the others to see, and its
  colour marks your moves; the bots and anyone without one are given their own. Kept on your device only.
- «Mes parties»: every game you finish on your device is listed under the greeting, with your place, who played,
  when, how and your points, and counts of games, wins and successful Tamalous. It stays on your device; save it to a
  file and restore it on another one.
- The publisher's statistics page now lists each day's games with their start time, length and outcome, opens a
  game on its own page, shows the hours and weekdays people play, and leads back to the site and the game. To do so
  the game statistics keep the time to the minute and a number drawn at random for each game (the legal notice says
  so); still no name and nothing that tells one device from another.
- Anonymous game statistics for the publisher, to improve the game: when a game starts or ends and when a room is
  created or joined, the online game sends a short report with no name, no room code and nothing that tells one
  device from another (the legal notice lists every field). The same switch as the audience counter turns them off.
- Your name is remembered on your device: joining a room by its link, or sitting down after watching, starts with
  it filled in.
- The home screen and the table's Display panel show which build you run next to the version (v0.14.0 · 64ef767),
  so a phone still on an older build can be spotted.
- Pause a game from the "⋯" menu at the top of the table: the table hides behind a curtain and everything stops
  (bots, the quick discard, the turn timer) until you resume. A game on your device also pauses by itself when you
  leave it for a call or another app. In a room, the game master pauses it for everyone and the others see who did.
- Powers are easier to see. The card you draw says what it would do if you throw it ("Pouvoir si tu la jettes :
  regarde une de tes cartes"), before you choose. While a power is played, a label under the piles says whose power it
  is and what it does, the discard that gave it lights up, and the player's seat carries its mark.
- Play with up to ten at the table (six before), in every mode: nine bots in solo, ten names on one device, ten seats
  in a room. A table whose hands do not fit in one deck (ten players with large hands) says so before the game and
  asks for two decks.
- During your own power, drag one of your cards onto the discard (or use the bolt) to let the power go and make a
  quick discard.
- Watch the others play: their moves are now played by their hand, a cursor with their name on a computer and a
  fingertip on a phone or a tablet. It reaches for a card, weighs one up before a swap, touches the cards a power looks
  at, and carries each card where it goes. It can be turned off in the settings or the table's Display button.
- Choose the bots' pace (brisk, normal or unhurried) and how fast cards fly (fast, normal or gentle), in the settings
  or the table's Display button. The pace never changes how quickly a bot claims a quick discard.
- Tap anywhere on the table to close what is open: a card a power shows you, a choice under way, a move waiting
  to be confirmed. Escape does the same.
- Choose how the card you draw shows: held just above your cards (the default, the table stays in sight) or large in
  the middle of the table, in the settings or the table's Display button. Either way, drag it onto one of your cards
  to swap it, or onto the discard to throw it; tapping still works.

### Changed

- The game no longer assumes you play on a phone: passing it round, «Mes parties», your profile, the home
  page, the legal notice and the link previews now speak of «un appareil» (a device), which may be a phone, a tablet
  or a computer. The pass-and-play mode is now called «À plusieurs, un seul appareil».
- A lighter top bar at the table: a button to leave, the round in the middle, the log, and a "⋯" menu holding pause,
  sound, vibrations, display, the rules and leaving the game. It fits the narrowest phones.
- The game log is redrawn and the game master now decides what it tells: the whole round, everyone's last turn (the
  default; the whole round with the Beginner rules) or nothing, to play from memory. Each player's turn is one block
  with their avatar and the card they threw, and a move on one of your cards stands out. On a computer it opens as a
  panel beside the table, which moves aside instead of being covered; on a phone it rises over your hand, half the
  screen or almost all of it. Its button in the top bar is now an icon.
- The rules screen is redrawn: the preset on top, then one illustrated tile per part of the rules with its rules
  in a line or two and a "changed" mark. Touch a tile to open it in place; on a computer the tiles stay in a column
  and the open one shows large beside them. Card points and powers are set on the cards themselves (touch a card,
  then − / + or its power), the cards seen at the start by touching them in the hand, and switches and numbers are
  easier to read.
- A room's waiting screen is redone for a full table: one "room access" ticket with the code, a QR code you tap
  to enlarge and a single "Invite players" button; the players as tiles in a grid; the button to start or to say you
  are ready pinned at the bottom of the screen.
- Nothing the table says covers the cards any more: what the others do, «À toi !» and the power being played show
  in a line of their own between the other players and the piles, one at a time, and a small icon by a player's name
  says what they just did (the same icons as the buttons). A power being played is also written in the instruction
  at the bottom, in orange, so it can never be missed.
- Quick-discarding an opponent's card you know is now on by default (it can be switched off in the rules). Once it
  has gone, you pick which of your cards to give them, knowing the claim worked; the table waits for your choice.
  Drag their card onto the discard, or use the bolt and touch it. Online rooms need everyone on the new version.
- The card turned over by the deal can no longer be quick-discarded on: nobody loses a card to a mistake before the
  first move. The game master can allow it again in the rules ("On the dealt card", under quick discard).
- Changing your mind is allowed until a card is put down. Tapping the discard, or "Prendre la défausse", lifts it
  without taking it: tap one of your cards to place it there, or tap beside it to put it back. Tapping the card you
  drew lifts it the same way and shows where it can go. Drawing from the deck is still final, since you have seen the
  card.
- The quick-discard window now lasts at least 3 seconds (it was 2), counted from when the card is down on the screen;
  it can still be changed in the rules.
- The bots wait for each move to finish on the screen before playing on, and "À toi !" comes once the others are done.
- What the others say, in their bubble and in the line at the top, now comes as their hand plays the move, not
  before.
- Your draw no longer waits for the quick-discard window when nobody else could claim it.
- A card a power lets you look at now comes up large in front of you and turns over, with whose card it is, instead
  of turning in place where it could be tiny or half hidden.
- On a computer, the oval drawn round the table is gone.
- The card another player draws now comes in front of them, face down for you, raised on their side as they look at
  it, with an eye; they swap it or throw it from there, instead of it waiting beside the discard.
- The backs of the other players' cards face them, turned round, and a card on its way to them comes round as it
  travels (dealt, drawn, given) instead of flipping when it lands.

### Fixed

- The end of a round speaks to you properly: "Tu as réussi ton Tamalou." instead of "Toi a réussi son Tamalou."
  ("You made your Tamalou." in English), and the scores show your name followed by "(toi)". On a device passed round
  several players, everyone goes by name.
- The deal: the deck counts down as it deals, your two cards to remember turn over together once it is done, and
  the discard's first card no longer flickers as it lands.
- On a phone, the screen behind an open panel (Display, settings, rules, a mode's panel) no longer scrolls under your
  finger.
- The others' hands now set out from their seat instead of sweeping in from off the screen, keep up with the bots
  (a swap is one gesture, and a hand that falls behind lets the card fly on its own), and the deck and the discard no
  longer shift when a drawn card appears, which made cards land on the deck.
- Another player's move now reads in order: the discard keeps its top card until their hand has put the new one down,
  a card turns over in the hand rather than after landing, and a hand goes back to its player's seat when their turn
  is over instead of stopping near your cards.
- In the "Posée" layout, the cards at both ends no longer look turned: the hand is laid flat without perspective.
- Every panel (Affichage, the settings, the rules, a mode's panel) closes on a tap beside it or with Escape, not only
  with "Fermer".
- The deal starts on an empty discard: its first card is put down at the end of the deal instead of showing from the
  start.
- On your own turn, before you draw, an open discard now glows and your cards lift as during the others' turns: a
  quick discard was already possible there but not shown.

## [0.14.0] - 2026-10-24 — Nain jaune

### Changed

- The cards are now dealt on the game's table itself, from the deck to every player's place, at the start of every
  round: no separate screen before the game, and nothing to skip.
- On a computer or a tablet held sideways, the table uses the whole width: the other players sit round it as at a real
  table, the cards are larger, and the journal opens at the side instead of over the game.

### Fixed

- A mistyped or outdated address now shows a real "page not found" page, in the site's colours, with a way to play or
  to go back home, instead of a home page without its styles.

## [0.13.0] - 2026-10-23 — Manille

### Changed

- A new screen to start a game: your last game waits at the top, ready to play again in one touch, and each way to
  play opens a panel where you set the table — opponents seated round it, a seat to add one, your name at your place —
  before choosing the bots' level and the rules. The cards are then dealt round the table before the game begins. The
  language, sounds and the hand's layout moved behind the settings button at the top.
- A quick discard is now made by hand: when the discard opens during someone else's turn, it glows and says "Throw
  here", your cards lift, and you drag the matching one onto it ("Let go to discard" once you are over it). The wide
  "Quick discard" button is gone; the small bolt beside the bar stays as a second way, tap it then your card.

## [0.12.0] - 2026-10-22 — Levée

### Added

- Choose how your hand is laid out on the table: in a row (now the default), the grid of before, laid down on the
  felt, in an arc, in a fan or in a carousel you slide through. Pick it in the settings, or during a game from the new
  Display button at the top of the table. The opponents' hands follow, their arcs and fans seen from across the table,
  and the rules speak of your hand as you see it: the cards you look at first are the right-hand ones in a line.

### Changed

- The first round on the home page is dealt on a smaller, livelier table: both hands curve like cards held in a hand,
  Malo's seen from across the table, with the deck and the discard side by side in the middle.

## [0.11.0] - 2026-10-21 — Kems

### Added

- Search engines and answer engines can find the site: a sitemap, a `robots.txt` and an `llms.txt` describing the
  game are published with the pages.

### Changed

- A link to Tamalou shared in a chat or on a social network now shows a card with the game's name and promise, in the
  language of the page, instead of the icon.

### Fixed

- Playing on the home network and online works again: since the game moved to `play/`, the "En ligne" mode no longer
  appeared, because the game looked for its server in the wrong folder.
- A game on the home network no longer shows « Connexion perdue » every 25 seconds: the LAN server mistook every
  phone for a lost one at each of its connection checks.

### Security

- The pages served online and by the LAN server carry security headers: the game can no longer be framed by another
  site, and a content security policy (reported only, for now) lists what the pages may load.

## [0.10.0] - 2026-10-20 — Joker

### Added

- The install dialog (Chrome on Android and desktop) shows screenshots of the game and what it is about.
- A long press on the installed icon (a right click on desktop) offers "Partie solo", which deals at once with your
  last setup, and "À plusieurs, un téléphone".
- On iPhone and iPad, the settings say how to add the game to the home screen.
- The game's home screen links back to the site's page ("Découvrir le jeu et ses règles"), in the installed app too.

### Changed

- A new version no longer takes over on its own: the home screen says one is ready, with "Recharger" and "Plus
  tard", and the game checks for one when it comes back to the foreground.
- The installed game opens at once from the files it keeps, online or not; the home pages and the legal notice stay
  current when the network answers.

### Fixed

- Offline on tamalou.steevepommier.com: the pages are now stored under the addresses the host serves directly, so
  they open without a network there too, not only on GitHub Pages.

## [0.9.0] - 2026-10-17 — Impasse

### Changed

- The game's address is now `play/`, the same word in both languages; `jouer/` links, shared rooms and the app
  installed on a phone follow on their own.

## [0.8.0] - 2026-10-17 — Honneur
<!-- commit: 2b824ccb76a4c375cabd918e56ad68c10af2bc93 -->

### Added

- A home page in French and English: play a guided first round against a bot right on the page, then guess what a
  hand is worth; the game itself moves to `jouer/`, and old links follow.
- A legal notice, and anonymous visit counting without cookies that anyone can decline.
- Sounds and vibrations follow the game (only what concerns you vibrates), with switches on the home screen and a
  mute button at the table; a call shows a "Tamalou !" splash.
- Play by hand: drag cards with soft physics, quick discard by dropping a card on the discard; every move flies its
  cards across the table, and the other players' moves show in bubbles.
- A spotlight on whose turn it is; the game master can ask for a confirmation before each move.
- The rules at the table as illustrated cards to leaf through, showing tonight's values.
- French and English, switched from the home screen and remembered on the device.
- Install the game: solo and pass-and-play work offline; a new version is offered on the home screen.
- The game's home screen shows the version you are playing.

### Changed

- The action bar stays on one line, with icons for the secondary moves.

### Fixed

- The table is pinned to the screen: the page never moves under a finger, and on a phone the deck and the discard
  no longer overlap the opponents.

## [0.7.0] - 2026-10-16 — Garde
<!-- commit: 3632d460fc31c92a4f0421109dc82176c9a7f6dd -->

### Added

- Play on the local network without internet: `pnpm serve:lan` or `docker compose up -d` starts the room server,
  which prints its address and a QR code to scan.

## [0.6.0] - 2026-10-16 — Figure
<!-- commit: 5179d975459294cd03d38960d949ead98c667bf5 -->

### Added

- Play online: create a room or join one by its code or link, a lobby run by the game master, reconnection, away
  seats played by stand-ins, spectators; rooms vanish after two idle hours.
- The online rooms run on a Cloudflare Worker, one room per Durable Object, nothing stored.

## [0.5.0] - 2026-10-16 — Écart
<!-- commit: 7d636b23b7e645350037a7fcffbc4196071b082f -->

### Added

- Pass-and-play: two to six players on one phone, bots optional, with a cover between players that shows nothing of
  the game, and the table as a spectator sees it while bots play.
- Quick discard starts switched off in pass-and-play; when it is on, a claim is made for a named player.

## [0.4.0] - 2026-10-16 — Dame
<!-- commit: 806b309f121316b854b90d0fbd8c2f6315325788 -->

### Added

- The game master sets every rule before the game, section by section, with a summary of what differs from
  Classique, also readable at the table.
- Rules shared by link, or exported and imported as a file.

## [0.3.0] - 2026-10-16 — Carreau
<!-- commit: 796bdfb1210a1b8d8b7fe0b2323979e4d36cdd8d -->

### Added

- Play a solo game against one to five bots in the browser, in portrait on a phone: the initial peek, every power,
  quick discard as an armed mode, the log, and the end of round and of game with the hands turned over.
- Published on GitHub Pages, with the full set of home-screen icons.

## [0.2.0] - 2026-10-16 — Brelan
<!-- commit: a007a90030abd83aaa8e6871d56a56b69541f28a -->

### Added

- Bots at three levels (easy, medium, hard) that see only what a player at their seat would, and a bot-against-bot
  tournament (`pnpm bots`).

## [0.1.0] - 2026-10-16 — As
<!-- commit: 042007b649ff54e30ce7315a3d717f55b6d2a466 -->

### Added

- The game engine with every rule configurable, three presets (Classique, Rapide, Débutant) and random game
  simulations (`pnpm simulate`).
