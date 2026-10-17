/**
 * The legal notice's texts (ADR-0018), French first and English typed against it. Inserted as HTML at build time
 * (src/legal/markup.ts): the markup here is on purpose. Placeholders: {email}, {source}, {license}.
 *
 * It states facts the code must keep true: what the game keeps on the device, what a room holds and for how long
 * (packages/room), and what audience measurement sends (src/audience.ts and its callers). Change one of those and
 * update this file in the same commit.
 */

const fr = {
  title: 'Mentions légales et confidentialité',
  description:
    'Qui publie Tamalou, qui l’héberge, et ce que le jeu sait de toi : presque rien. Pas de compte, pas de cookie, une mesure d’audience anonyme.',
  intro:
    'Qui publie Tamalou, qui l’héberge, et ce que le jeu sait de toi&#160;: presque rien. Pas de compte, pas de cookie, pas de publicité.',
  updated: 'Dernière mise à jour le 17 octobre 2026.',
  tocAria: 'Sur cette page',

  pubTitle: 'Éditeur',
  pub1: 'Tamalou est édité par <b>Steeve Pommier</b>, particulier, à titre non commercial&#160;: il est gratuit, sans publicité, et ne vend rien.',
  pubContact: 'Contact&#160;: {email}',
  pub2: 'En tant qu’éditeur non professionnel, les informations d’identification prévues par la loi (Loi pour la confiance dans l’économie numérique, art. 6-III) sont conservées auprès de l’hébergeur ci-dessous.',

  hostTitle: 'Hébergement',
  host1:
    '<b>tamalou.steevepommier.com</b> tourne sur Cloudflare Workers, qui fait aussi tourner les salles de jeu en ligne&#160;: Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107, États-Unis, <a href="https://www.cloudflare.com">cloudflare.com</a>.',
  host2:
    'Une copie sans jeu en ligne est servie par GitHub Pages à l’adresse <b>costardrouge.github.io/tamalou</b>&#160;: GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis, <a href="https://github.com">github.com</a>.',
  host3:
    'La version pour le réseau local tourne sur l’ordinateur de la personne qui la lance, chez elle&#160;: rien n’en sort vers l’éditeur. La mesure d’audience tourne sur un serveur de l’éditeur (voir Confidentialité).',

  privTitle: 'Confidentialité',
  privShort:
    'En bref&#160;: Tamalou ne sait pas qui tu es et ne cherche pas à le savoir. Pas de compte, pas de cookie, pas de publicité.',

  deviceTitle: 'Sur ton appareil',
  device1:
    'Une partie seul ou à plusieurs sur un téléphone se joue entièrement dans ton navigateur&#160;: rien n’est envoyé. Le jeu garde dans le stockage local de ton navigateur, sur cet appareil seulement, la langue, les sons et vibrations, et ta dernière mise en place (mode, prénoms, nombre et niveau des bots, règles), pour la proposer la fois suivante&#160;; et, si tu joues en ligne, un jeton par salle pendant un jour, pour reprendre ta place après une coupure.',
  device2:
    'Ouvrir le jeu range aussi ses propres fichiers dans le cache du navigateur, pour qu’il marche hors ligne&#160;: des fichiers, jamais tes données. Pour tout effacer, efface les données de ce site dans les réglages de ton navigateur.',

  roomsTitle: 'Salles en ligne',
  rooms1:
    'Dans une salle en ligne, le prénom que tu tapes et tes coups passent par le serveur, qui les montre aux autres joueurs de la salle (chacun ne voit que ce que les règles lui permettent de voir). Rien n’est écrit sur disque&#160;: la salle vit en mémoire et disparaît après deux heures sans activité, ou quand une partie finie n’a plus personne. Toute personne qui a le code ou le lien d’une salle peut la rejoindre ou regarder&#160;: ne mets rien de personnel dans ton prénom.',

  countTitle: 'Mesure d’audience',
  count1:
    'Les visites sont comptées avec <a href="https://umami.is">Umami</a>, auto-hébergé sur un serveur de l’éditeur à l’adresse <code>insight.steevepommier.com</code>&#160;: aucun tiers ne reçoit les données, et rien ne sert à la publicité.',
  count2:
    '<b>Ce qui est compté&#160;:</b> les pages vues (l’accueil, ces mentions, l’écran d’accueil du jeu, une partie, une salle en ligne, sans son code)&#160;; le site d’où tu viens&#160;; quelques événements anonymes (une partie lancée, avec son mode, le nombre et le niveau des bots, le préréglage et si des règles ont été changées&#160;; une partie terminée et son nombre de manches&#160;; une salle créée&#160;; des règles partagées et par quel moyen&#160;; une installation&#160;; sur l’accueil, la manche d’essai finie, gagnée ou non, avec le nombre de gestes essayés, et chaque réponse au test des valeurs, juste ou non)&#160;; ton navigateur, ton système, le type d’appareil, la taille d’écran, la langue et le pays.',
  count3:
    '<b>Ce qui ne l’est jamais&#160;:</b> les prénoms, le code d’une salle, le détail des règles, tes coups ou tes cartes, ton adresse IP (elle donne le pays, puis est oubliée), ni rien qui puisse te suivre d’un site à l’autre. Aucun cookie n’est déposé. La version pour le réseau local ne compte rien.',
  count4:
    'Le compteur n’est même pas chargé quand ton navigateur envoie <i>Do Not Track</i> ou <i>Global Privacy Control</i>, ou quand tu le coupes ci-dessous&#160;; ce choix est gardé dans ce navigateur.',
  countOn: 'Tes visites sont comptées, anonymement, dans ce navigateur.',
  countOff: 'Tes visites ne sont pas comptées dans ce navigateur.',
  countSignal: 'Ton navigateur demande à ne pas être suivi&#160;: tes visites ne sont pas comptées.',
  countNone: 'Cette copie de Tamalou ne compte pas les visites.',
  countStop: 'Ne plus compter mes visites',
  countResume: 'Compter à nouveau mes visites',

  cookiesTitle: 'Cookies',
  cookies1: 'Tamalou ne dépose aucun cookie, donc pas de bandeau de consentement&#160;: il n’y a rien à accepter.',

  logsTitle: 'Hébergement et abus',
  logs1:
    'Comme tout hébergeur, Cloudflare (et GitHub pour la copie) traite ton adresse IP pour délivrer les pages et protéger le site&#160;: voir la <a href="https://www.cloudflare.com/privacypolicy/">politique de confidentialité de Cloudflare</a>. Tamalou s’en sert pour limiter le nombre de salles qu’une même adresse peut créer par minute, sans la garder. Cloudflare conserve quelques jours des journaux techniques des appels au serveur, que l’éditeur consulte pour corriger les erreurs.',

  rightsTitle: 'Tes droits',
  rights1:
    'Le RGPD te permet de demander l’accès aux données qui te concernent ou leur effacement. Tamalou n’en garde aucune qui te nomme&#160;: tes réglages sont sur ton appareil, et une salle en ligne s’efface d’elle-même. Pour toute question ou demande, écris à {email}&#160;; tu peux aussi adresser une réclamation à la <a href="https://www.cnil.fr">CNIL</a>.',

  licenceTitle: 'Licence',
  licence1:
    'Tamalou est un logiciel libre&#160;: son <a href="{source}">code source</a> est publié sous <a href="{license}">licence MIT</a>. Le Tamalou est un jeu de cartes traditionnel&#160;; ses règles n’appartiennent à personne.',

  liabTitle: 'Responsabilité',
  liab1:
    'Tamalou est fourni tel quel, de bonne foi, sans garantie d’aucune sorte. Les liens vers d’autres sites sont donnés par commodité&#160;; leur contenu leur appartient. Quelque chose ici porte atteinte à un de tes droits&#160;? Écris à {email}, et ce sera corrigé.',
};

export type LegalText = typeof fr;

const en: LegalText = {
  title: 'Legal notice and privacy',
  description:
    'Who publishes Tamalou, who hosts it, and what the game knows about you: almost nothing. No account, no cookie, anonymous audience measurement.',
  intro:
    'Who publishes Tamalou, who hosts it, and what the game knows about you: almost nothing. No account, no cookie, no ads.',
  updated: 'Last updated on 17 October 2026.',
  tocAria: 'On this page',

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
    'A game solo or around one phone is played entirely in your browser: nothing is sent. The game keeps in your browser’s local storage, on this device only, the language, sounds and vibrations, and your last setup (mode, names, number and level of bots, rules), to offer it next time; and, if you play online, one token per room for a day, to take your seat back after a dropout.',
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
  count4:
    'The counter is not even loaded when your browser sends <i>Do Not Track</i> or <i>Global Privacy Control</i>, or when you switch it off below; that choice is kept in this browser.',
  countOn: 'Your visits are counted, anonymously, in this browser.',
  countOff: 'Your visits are not counted in this browser.',
  countSignal: 'Your browser asks not to be tracked: your visits are not counted.',
  countNone: 'This copy of Tamalou does not count visits.',
  countStop: 'Stop counting my visits',
  countResume: 'Count my visits again',

  cookiesTitle: 'Cookies',
  cookies1: 'Tamalou sets no cookie, hence no consent banner: there is nothing to accept.',

  logsTitle: 'Hosting and abuse',
  logs1:
    'Like any host, Cloudflare (and GitHub for the copy) processes your IP address to deliver the pages and protect the site: see <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare’s privacy policy</a>. Tamalou uses it to limit how many rooms one address can create per minute, without keeping it. Cloudflare keeps technical logs of calls to the server for a few days, which the publisher reads to fix errors.',

  rightsTitle: 'Your rights',
  rights1:
    'The GDPR lets you ask for access to the data about you, or for its deletion. Tamalou keeps none that names you: your settings are on your device, and an online room erases itself. For any question or request, write to {email}; you can also lodge a complaint with the <a href="https://www.cnil.fr">CNIL</a>.',

  licenceTitle: 'Licence',
  licence1:
    'Tamalou is free software: its <a href="{source}">source code</a> is published under the <a href="{license}">MIT licence</a>. Tamalou is a traditional card game; its rules belong to no one.',

  liabTitle: 'Liability',
  liab1:
    'Tamalou is provided as is, in good faith, with no warranty of any kind. Links to other sites are given for convenience; their content is theirs. Something here infringes one of your rights? Write to {email}, and it will be fixed.',
};

export const LEGAL: Record<'fr' | 'en', LegalText> = { fr, en };
