# Changelog

What each release of Tamalou brings to the people who play it. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html); `.github/workflows/release.yml` turns each section into a
tag and a GitHub Release once it reaches `main` (COMMON-PROJECT-SPEC C13, ADR-0019). Written in English, like the
code, though the game speaks French first. Codenames are French card words, in alphabetical order.

## [Unreleased]

### Fixed

- Playing on the home network and online works again: since the game moved to `play/`, the "En ligne" mode no longer
  appeared, because the game looked for its server in the wrong folder.
- A game on the home network no longer shows « Connexion perdue » every 25 seconds: the LAN server mistook every
  phone for a lost one at each of its connection checks.

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
