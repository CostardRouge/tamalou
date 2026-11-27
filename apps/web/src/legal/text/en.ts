import type { LegalText } from './fr.ts';

/** The legal notice in English (fr.ts is the source; the French version prevails). */
const en: LegalText = {
  title: 'Legal notice and privacy',
  description:
    'Who publishes Tamalou, who hosts it, and what the game knows about you: almost nothing. No account, no cookie, anonymous audience measurement.',
  intro:
    'Who publishes Tamalou, who hosts it, and what the game knows about you: almost nothing. No account, no cookie, no ads.',
  updated: 'Last updated on 17 October 2026.',
  tocAria: 'On this page',
  translated: 'This translation is given for information; the French version prevails.',

  pubTitle: 'Publisher',
  pub1: 'Tamalou is published by <b>Steeve Pommier</b>, a private individual, on a non-commercial basis: it is free, has no ads and sells nothing.',
  pubContact: 'Contact: {email}',
  pub2: 'As a non-professional publisher, the identification details required by French law (Loi pour la confiance dans l’économie numérique, art. 6-III) are kept with the host named below.',

  hostTitle: 'Hosting',
  host1:
    '<b>tamalou.steevepommier.com</b> runs on Cloudflare Workers, which also runs the online rooms: Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107, United States, <a href="https://www.cloudflare.com">cloudflare.com</a>.',
  host2:
    'A copy without online play is served by GitHub Pages at <b>costardrouge.github.io/tamalou</b>: GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, United States, <a href="https://github.com">github.com</a>.',
  host3:
    'The local network version runs on the computer of whoever starts it, at their place: nothing from it reaches the publisher. Audience measurement runs on a server of the publisher’s (see Privacy).',

  privTitle: 'Privacy',
  privShort: 'In short: Tamalou does not know who you are and does not try to. No account, no cookie, no ads.',

  deviceTitle: 'On your device',
  device1:
    'A game solo or around one device is played entirely in your browser: nothing is sent. The game keeps in your browser’s local storage, on this device only, the language, sounds and vibrations, how your cards look, and your last setup (mode, names, number and level of bots, rules), to offer it next time, as well as your name and your avatar (a colour and an icon), so you need not pick them again; when you join a room, your name and avatar are shown to the other players in it; the list of the games you finished on this device (date, mode, the other players’ names, your place, your points, your Tamalous), for “My games”, which you can save to a file and restore; if you play online, one token per room for a day, to take your seat back after a dropout; and the game statistics’ random number (below), as long as “Recognise this device” is on in the settings.',
  device2:
    'Opening the game also stores its own files in the browser’s cache, so that it works offline: files, never your data. To erase everything, clear this site’s data in your browser’s settings.',

  roomsTitle: 'Online rooms',
  rooms1:
    'In an online room, the name you type and your moves go through the server, which shows them to the other players in the room (each one sees only what the rules let them see). Nothing is written to disk: the room lives in memory and disappears after two hours without activity, or once a finished game has nobody left. Anyone with a room’s code or link can join it or watch: keep your name impersonal.',

  countTitle: 'Audience measurement',
  count1:
    'Visits are counted with <a href="https://umami.is">Umami</a>, self-hosted on a server of the publisher’s at <code>insight.steevepommier.com</code>: no third party receives the data, and nothing is used for advertising.',
  count2:
    '<b>What is counted:</b> page views (the home page, this notice, the game’s home screen, a game, an online room without its code); the site you came from; a few anonymous events (a game started, with its mode, the number and level of bots, the preset and whether rules were changed; a game finished and its number of rounds; a room created; rules shared and how; an install; on the home page, the practice round finished, won or not, with the number of moves tried, and each answer to the values test, right or not); your browser, system, device type, screen size, language and country.',
  count3:
    '<b>What never is:</b> names, a room’s code, the details of the rules, your moves or your cards, your IP address (it gives the country, then is forgotten), nor anything that could follow you from one site to another. No cookie is set. The local network version counts nothing.',
  count5:
    '<b>Game statistics.</b> The online game also sends Tamalou’s server, on Cloudflare, a short anonymous report when a game starts or ends and when a room is created or joined: the mode, the number of players, humans and bots, the bots’ level, the preset and whether rules were changed, the number of rounds, the length in minutes, whether you won a solo game, the way into a room (QR code, link or typed code), and how your device is set up (language, kind of device, orientation, connection type, game installed or not, sound, vibrations, hand layout, how the drawn card shows, the bots’ pace, the cards’ speed). The server adds only the day and the time, to the minute. A game carries a number drawn at random for it alone, which ties its start to its end: two games of one device have unrelated numbers. To know how many devices come back to play, a report also carries a number your device drew at random and keeps: it says nothing about you, serves these statistics only, is replaced by a new one after 13 months, and stops and is erased when you switch “Recognise this device” off in the game’s settings. No name, no room code, no IP address. Only the publisher reads them, as overall figures, to improve the game; they are deleted after 13 months. The same choice stops them: nothing is sent when the counter is switched off below, or when your browser asks not to be tracked. A game on GitHub Pages or on the local network sends nothing.',
  count4:
    'The counter is not even loaded when your browser sends <i>Do Not Track</i> or <i>Global Privacy Control</i>, or when you switch it off below; that choice is kept in this browser.',
  countOn: 'Your visits are counted, anonymously, in this browser.',
  countOff: 'Your visits are not counted in this browser.',
  countSignal: 'Your browser asks not to be tracked: your visits are not counted.',
  countNone: 'This copy of Tamalou does not count visits.',
  countStop: 'Stop counting my visits',
  countResume: 'Count my visits again',

  cookiesTitle: 'Cookies',
  cookies1:
    'Tamalou sets no cookie on its players, hence no consent banner: there is nothing to accept. Only the publisher’s admin page sets one, for his own session.',

  logsTitle: 'Hosting and abuse',
  logs1:
    'Like any host, Cloudflare (and GitHub for the copy) processes your IP address to deliver the pages and protect the site: see <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare’s privacy policy</a>. Tamalou uses it to limit how many rooms one address can create per minute, without keeping it. Cloudflare keeps technical logs of calls to the server for a few days, which the publisher reads to fix errors.',

  rightsTitle: 'Your rights',
  rights1:
    'The GDPR lets you ask for access to the data about you, or for its deletion. Tamalou keeps none that names you: your settings are on your device, an online room erases itself, and the game statistics are anonymous. For any question or request, write to {email}; you can also lodge a complaint with the <a href="https://www.cnil.fr">CNIL</a>.',

  licenceTitle: 'Licence',
  licence1:
    'Tamalou is free software: its <a href="{source}">source code</a> is published under the <a href="{license}">MIT licence</a>. Tamalou is a traditional card game; its rules belong to no one.',

  liabTitle: 'Liability',
  liab1:
    'Tamalou is provided as is, in good faith, with no warranty of any kind. Links to other sites are given for convenience; their content is theirs. Something here infringes one of your rights? Write to {email}, and it will be fixed.',
};

export default en;
