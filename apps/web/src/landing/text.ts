/**
 * The home page's texts (ADR-0016), French first and English typed against it, so a missing key fails the typecheck.
 * Read at build time (src/landing/markup.ts writes the page) and in the browser (the live table's captions): plain data,
 * no import. Inline markup (<em>, <b>) is written here on purpose and inserted as is.
 */

const fr = {
  title: 'Tamalou — le jeu de cartes de mémoire et de bluff, à jouer en ligne',
  description:
    'Tamalou, le jeu de cartes où le plus petit total gagne : quatre cartes face cachée, de la mémoire et du bluff. Seul contre des bots, à plusieurs sur un téléphone, en Wi-Fi ou en ligne. Gratuit, sans compte.',
  navAria: 'Sections',
  navRules: 'Règles',
  navModes: 'Modes',
  navPlay: 'Jouer',
  otherLang: 'English',
  otherLangShort: 'EN',

  eyebrow: 'Le jeu de cartes de mémoire et de bluff',
  heroTitle: 'Quatre cartes. Ta mémoire. Et un mot&#160;: <em>Tamalou&#160;!</em>',
  heroLead:
    'Le jeu qu’on sort en fin de repas, dans ton téléphone. Seul contre des bots, à plusieurs autour d’un même écran, sur le Wi-Fi de la maison ou en ligne avec un simple code.',
  play: 'Jouer maintenant',
  rulesLink: 'Les règles en une minute',
  facts: ['Gratuit', 'Sans compte', 'Marche hors ligne', 'Toutes les règles réglables'],

  liveAria: 'Une manche de Tamalou jouée en accéléré, contre Léa et Malo',
  liveNames: ['Léa', 'Malo', 'Toi'],
  livePiles: ['Pioche', 'Défausse'],
  liveQuick: 'Léa : défausse rapide !',
  livePower: 'Pouvoir du 7',
  liveSplash: 'Tamalou\u00a0!',
  livePoints: '{n} pts',
  livePause: 'Pause',
  liveResume: 'Reprendre',
  liveRestart: 'Revoir depuis le début',
  liveStepsAria: 'Les étapes de la manche',
  liveSteps: [
    'Regarde deux cartes',
    'Pioche',
    'Échange ou défausse',
    'Défausse rapide',
    'Pouvoirs',
    '« Tamalou ! »',
    'Le plus petit total gagne',
  ],
  liveCaptions: [
    'On mélange, on distribue…',
    'Chacun reçoit quatre cartes, face cachée. Le but : finir la manche avec le plus petit total.',
    'Tu regardes tes deux cartes du bas : un 2, et un Roi rouge qui vaut zéro. Retiens-les bien.',
    'Elles se retournent. À toi de t’en souvenir.',
    'À ton tour, tu pioches : un 3. Mieux que ce qui dort en haut à gauche ?',
    'Tu l’échanges. Ta vieille carte part sur la défausse, face visible : c’était un 9.',
    'Un 9 sur la défausse ? Léa en avait un : défausse rapide, même hors de son tour. Une carte de moins pour elle.',
    'Nouveau tour, tu pioches un 7.',
    'Tu le défausses aussitôt : son pouvoir te laisse regarder une de tes cartes. Un as, parfait.',
    'Tu connais toute ta main : 3, 1, 2 et 0.',
    'Six points en tout : tu annonces « Tamalou ! ». Les autres jouent un dernier tour.',
    'On retourne tout. 6 pour toi, 20 pour Léa, 33 pour Malo : la manche est à toi.',
  ],

  rulesTitle: 'Les règles en une minute',
  rulesSub:
    'Le but&#160;: finir la manche avec le plus petit total de points. Tout le sel est dans ce que tu crois savoir de tes propres cartes.',
  rules: [
    { t: 'Quatre cartes, face cachée', p: 'Tu en regardes deux au début. Les autres, tu les découvriras… ou pas.' },
    {
      t: 'Pioche, échange ou défausse',
      p: 'Prends la pioche ou la défausse. Garde la carte en l’échangeant avec une des tiennes, ou jette-la.',
    },
    {
      t: 'Défausse rapide',
      p: 'Même rang que la carte du dessus&#160;? Jette la tienne, même hors de ton tour. Si tu te trompes&#160;: une carte de pénalité.',
    },
    {
      t: '«&#160;Tamalou&#160;!&#160;»',
      p: 'Tu crois avoir le plus petit total&#160;? Annonce-le. Les autres jouent un dernier tour. Pas le plus bas&#160;? +10.',
    },
  ],

  valuesTitle: 'Ce que valent les cartes',
  valuesSub: 'Chaque carte compte sa valeur. Les têtes coûtent cher, et une seule ne vaut rien du tout.',
  values: [
    { card: 'A-S', name: 'As', value: '1' },
    { card: '2-H', name: 'Deux', value: '2' },
    { card: '5-C', name: 'Cinq', value: '5' },
    { card: '9-D', name: 'Neuf', value: '9' },
    { card: 'J-S', name: 'Valet', value: '10' },
    { card: 'Q-H', name: 'Dame', value: '10' },
    { card: 'K-C', name: 'Roi noir', value: '10' },
  ],
  redKing: { card: 'K-H', name: 'Roi rouge', value: '0', tag: 'La carte que tout le monde veut' },
  pointsWord: 'points',

  powersTitle: 'Des cartes qui ont un pouvoir',
  powersSub: 'Pioche-les, puis défausse-les aussitôt&#160;: leur pouvoir s’active. Tu peux toujours t’en passer.',
  powers: [
    { cards: ['7-C', '8-H'], t: 'Regarde une de tes cartes', p: 'Pour enfin savoir ce qui dort en haut à gauche.' },
    {
      cards: ['9-D', '10-S'],
      t: 'Regarde une carte d’un adversaire',
      p: 'Il bluffe peut-être moins que tu ne crois.',
    },
    { cards: ['J-C'], t: 'Échange à l’aveugle', p: 'Une de tes cartes contre une des siennes, sans regarder.' },
    { cards: ['Q-D'], t: 'Regarde, puis décide', p: 'Regarde n’importe quelle carte, et échange-la si elle te plaît.' },
  ],

  modesTitle: 'Quatre façons de jouer',
  modesSub: 'La même partie partout, avec ou sans internet. Bots et humains peuvent se mélanger à la même table.',
  modes: [
    {
      icon: 'bot',
      t: 'Seul contre des bots',
      p: 'Trois niveaux, du bot qui oublie tout à celui qui compte les cartes.',
    },
    {
      icon: 'phone',
      t: 'Sur un seul téléphone',
      p: 'On se passe l’appareil. Un écran cache ton jeu entre deux joueurs.',
    },
    {
      icon: 'home',
      t: 'Sur le réseau de la maison',
      p: 'Chacun sur son téléphone, sans internet&#160;: un petit serveur et un QR code.',
    },
    { icon: 'globe', t: 'En ligne', p: 'Une salle éphémère, un code ou un lien à partager. Pas de compte.' },
  ],

  tableTitle: 'Tes règles, ta table',
  tableSub:
    'Chez toi, le Valet ne fait peut-être pas la même chose. Avant la partie, chaque règle se règle&#160;: valeurs, pouvoirs, pénalités, fin de partie. Et se partage d’un lien.',
  presetsAria: 'Préréglages',
  presetRows: ['Éliminé à', 'Tamalou raté', 'Fin de partie', 'Cartes déjà vues'],
  presets: [
    {
      id: 'classic',
      name: 'Classique',
      desc: 'Les règles de la maison : 4 cartes, éliminé à 100, +10 pour un Tamalou raté.',
      cells: ['100', '+10', 'Dernier en lice', 'Cachées'],
    },
    {
      id: 'quick',
      name: 'Rapide',
      desc: 'Une partie courte : éliminé à 50, et la partie s’arrête au premier éliminé.',
      cells: ['50', '+10', 'Premier éliminé', 'Cachées'],
    },
    {
      id: 'beginner',
      name: 'Débutant',
      desc: 'Les cartes déjà vues restent affichées : pour apprendre sans travailler sa mémoire.',
      cells: ['100', '+10', 'Dernier en lice', 'Affichées'],
    },
  ],

  finalTitle: 'Prêt à oublier où est ton Roi&#160;?',
  finalSub: 'Dans le navigateur, sur téléphone, tablette ou ordinateur. Installable comme une app.',

  footBy: 'Tamalou, un jeu de <a href="{url}">{name}</a>',
  footAria: 'Pied de page',
  footSource: 'Code source',
};

export type LandingText = typeof fr;

const en: LandingText = {
  title: 'Tamalou — the memory and bluffing card game, to play online',
  description:
    'Tamalou, the French card game where the lowest total wins: four face-down cards, memory and bluff. Solo against bots, around one phone, on your Wi-Fi or online. Free, no account.',
  navAria: 'Sections',
  navRules: 'Rules',
  navModes: 'Modes',
  navPlay: 'Play',
  otherLang: 'Français',
  otherLangShort: 'FR',

  eyebrow: 'The memory and bluffing card game',
  heroTitle: 'Four cards. Your memory. And one word: <em>Tamalou!</em>',
  heroLead:
    'The game French families bring out after dinner, now on your phone. Solo against bots, together around one screen, on your home Wi-Fi or online with a simple code.',
  play: 'Play now',
  rulesLink: 'The rules in one minute',
  facts: ['Free', 'No account', 'Works offline', 'Every rule adjustable'],

  liveAria: 'A round of Tamalou played fast, against Léa and Malo',
  liveNames: ['Léa', 'Malo', 'You'],
  livePiles: ['Deck', 'Discard'],
  liveQuick: 'Léa: quick discard!',
  livePower: 'Power of the 7',
  liveSplash: 'Tamalou!',
  livePoints: '{n} pts',
  livePause: 'Pause',
  liveResume: 'Resume',
  liveRestart: 'Watch from the start',
  liveStepsAria: 'The steps of the round',
  liveSteps: [
    'Peek at two cards',
    'Draw',
    'Swap or discard',
    'Quick discard',
    'Powers',
    '“Tamalou!”',
    'Lowest total wins',
  ],
  liveCaptions: [
    'Shuffle, deal…',
    'Everyone gets four cards, face down. The goal: end the round with the lowest total.',
    'You peek at your two bottom cards: a 2, and a red King worth zero. Remember them.',
    'They turn back over. Now it is up to your memory.',
    'Your turn: you draw a 3. Better than whatever sleeps top left?',
    'You swap it in. Your old card goes face up on the discard pile: it was a 9.',
    'A 9 on the discard? Léa had one: quick discard, even out of turn. One card fewer for her.',
    'Next turn, you draw a 7.',
    'You discard it at once: its power lets you look at one of your cards. An ace, perfect.',
    'You know your whole hand: 3, 1, 2 and 0.',
    'Six points in all: you call “Tamalou!”. Everyone else plays one last turn.',
    'All cards face up. 6 for you, 20 for Léa, 33 for Malo: the round is yours.',
  ],

  rulesTitle: 'The rules in one minute',
  rulesSub:
    'The goal: end the round with the lowest total. The fun lies in what you think you know about your own cards.',
  rules: [
    { t: 'Four cards, face down', p: 'You peek at two at the start. The others, you will find out… or not.' },
    {
      t: 'Draw, swap or discard',
      p: 'Take from the deck or the discard. Keep the card by swapping it with one of yours, or throw it away.',
    },
    {
      t: 'Quick discard',
      p: 'Same rank as the top card? Throw yours, even out of turn. Get it wrong: a penalty card.',
    },
    {
      t: '“Tamalou!”',
      p: 'Think you have the lowest total? Call it. Everyone else plays one last turn. Not the lowest? +10.',
    },
  ],

  valuesTitle: 'What the cards are worth',
  valuesSub: 'Every card counts its value. Face cards cost a lot, and one is worth nothing at all.',
  values: [
    { card: 'A-S', name: 'Ace', value: '1' },
    { card: '2-H', name: 'Two', value: '2' },
    { card: '5-C', name: 'Five', value: '5' },
    { card: '9-D', name: 'Nine', value: '9' },
    { card: 'J-S', name: 'Jack', value: '10' },
    { card: 'Q-H', name: 'Queen', value: '10' },
    { card: 'K-C', name: 'Black King', value: '10' },
  ],
  redKing: { card: 'K-H', name: 'Red King', value: '0', tag: 'The card everyone wants' },
  pointsWord: 'points',

  powersTitle: 'Cards with a power',
  powersSub: 'Draw one, then discard it at once: its power wakes up. You can always skip it.',
  powers: [
    { cards: ['7-C', '8-H'], t: 'Look at one of your cards', p: 'To finally know what sleeps top left.' },
    { cards: ['9-D', '10-S'], t: 'Look at an opponent’s card', p: 'Maybe they bluff less than you think.' },
    { cards: ['J-C'], t: 'Blind swap', p: 'One of your cards for one of theirs, without looking.' },
    { cards: ['Q-D'], t: 'Look, then decide', p: 'Look at any card, and swap it if you like it.' },
  ],

  modesTitle: 'Four ways to play',
  modesSub: 'The same game everywhere, with or without internet. Bots and humans can share the same table.',
  modes: [
    {
      icon: 'bot',
      t: 'Solo against bots',
      p: 'Three levels, from the bot who forgets everything to the one who counts cards.',
    },
    { icon: 'phone', t: 'Around one phone', p: 'Pass the device around. A screen hides your hand between players.' },
    {
      icon: 'home',
      t: 'On your home network',
      p: 'Everyone on their own phone, no internet: a small server and a QR code.',
    },
    { icon: 'globe', t: 'Online', p: 'A short-lived room, a code or a link to share. No account.' },
  ],

  tableTitle: 'Your rules, your table',
  tableSub:
    'At your place, the Jack might do something else. Before the game, every rule can be set: values, powers, penalties, how the game ends. And shared with a link.',
  presetsAria: 'Presets',
  presetRows: ['Out at', 'Failed Tamalou', 'Game ends', 'Cards already seen'],
  presets: [
    {
      id: 'classic',
      name: 'Classic',
      desc: 'House rules: 4 cards, out at 100, +10 for a failed Tamalou.',
      cells: ['100', '+10', 'Last one standing', 'Hidden'],
    },
    {
      id: 'quick',
      name: 'Quick',
      desc: 'A short game: out at 50, and the game stops at the first player out.',
      cells: ['50', '+10', 'First one out', 'Hidden'],
    },
    {
      id: 'beginner',
      name: 'Beginner',
      desc: 'Cards already seen stay visible: learn the game without training your memory.',
      cells: ['100', '+10', 'Last one standing', 'Shown'],
    },
  ],

  finalTitle: 'Ready to forget where your King is?',
  finalSub: 'In the browser, on a phone, a tablet or a computer. Installable as an app.',

  footBy: 'Tamalou, a game by <a href="{url}">{name}</a>',
  footAria: 'Footer',
  footSource: 'Source code',
};

export const LANDING: Record<'fr' | 'en', LandingText> = { fr, en };
