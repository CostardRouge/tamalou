/**
 * The home page's texts (ADR-0017), French: the source, every other language is typed against it (`LandingText`), so a
 * missing key fails the typecheck. Read at build time (src/landing/markup.ts writes the page) and in the browser (the
 * first round and the quiz load their page's language only, src/landing/main.tsx): plain data, no import. Inline
 * markup (<em>) is inserted as is in the page; texts the scripts draw stay plain, with ` ` for no-break spaces
 * (never an HTML entity). Placeholders: {card}, {value}, {n}, {me}, {bot}…
 */

const fr = {
  title: 'Tamalou — le jeu de cartes de mémoire et de bluff, à jouer en ligne',
  description:
    'Joue ta première manche de Tamalou en une minute, ici même : quatre cartes face cachée, de la mémoire et du bluff, le plus petit total gagne. Seul contre des bots, à plusieurs sur un seul appareil, en Wi-Fi ou en ligne. Gratuit, sans compte.',
  navAria: 'Sections',
  navRound: 'La manche',
  navValues: 'Les valeurs',
  navModes: 'Modes',
  navPlay: 'Jouer',
  langMenu: 'Langue : {lang}',

  eyebrow: 'Apprends en jouant · une minute',
  heroTitle: 'Ta première manche de Tamalou, <em>ici même.</em>',
  heroLead:
    'Pas de règles à lire : Malo, un bot pas très malin, t’attend. Suis le guide, et annonce « Tamalou ! » quand tu crois avoir le plus petit total.',

  roundAria: 'Une manche d’essai contre un bot',
  bot: 'Malo',
  you: 'Toi',
  piles: ['Pioche', 'Défausse'],
  splash: 'Tamalou !',
  where: ['tout à gauche', 'au milieu à gauche', 'au milieu à droite', 'tout à droite'],
  yourSlot: 'Ta carte {where}',
  botSlot: 'La carte de Malo {where}',
  points: '{who} : {n}',

  tagTurn: 'Ton tour · {n}',
  tagBot: 'Au tour de Malo',
  tagLast: 'Dernier tour',
  tagEnd: 'Fin de la manche',
  peekTitle: 'Retiens tes deux cartes de droite',
  peekText: 'Touche-les pour les regarder. Elles vont se retourner : la mémoire, c’est tout le jeu.',
  waitTitle: 'Retiens bien…',
  waitText: 'Ce que tu vois ne restera pas affiché longtemps.',
  calledTitle: 'Tamalou !',
  calledText: 'Malo joue un dernier tour, puis on retourne tout.',
  turnTitle: 'À toi de jouer',
  turnFirst: 'Pioche une carte inconnue, ou prends la carte visible de la défausse : {card}, qui vaut {value}.',
  turnNext: 'Pioche, prends la défausse ({card}), ou annonce « Tamalou ! » si tu crois avoir le plus petit total.',
  lowTitle: 'La pioche est presque vide',
  lowText: 'Dans cette manche d’essai, c’est le moment : annonce « Tamalou ! ».',
  takeTitle: 'Tu prends {card}',
  takeText: 'Une carte prise dans la défausse doit être gardée : touche la carte qu’elle remplace.',
  drawTitle: 'Tu pioches {card}',
  drawPeekOwn:
    'Défausse-la tout de suite : son pouvoir te laisse regarder une de tes cartes. Ou garde-la en touchant une carte.',
  drawPeekOther: 'Défausse-la pour regarder une carte de Malo, ou garde-la en touchant une de tes cartes.',
  drawLow: 'C’est une petite carte : garde-la. Touche une de tes cartes de gauche, celles que tu ne connais pas.',
  drawOther: 'Garde-la en touchant la carte qu’elle remplace, ou défausse-la.',
  powerOwnTitle: 'Pouvoir : regarde une de tes cartes',
  powerOwnText: 'Touche celle que tu ne connais pas encore.',
  powerOtherTitle: 'Pouvoir : regarde une carte de Malo',
  powerOtherText: 'Touche une de ses cartes. Savoir ce qu’il cache aide à choisir le moment de dire Tamalou.',
  quickTitle: 'Défausse rapide !',
  quickText: 'Malo vient de jeter {card}. Tu en as une de même rang, et tu sais où : touche-la, vite.',
  botTitle: 'Malo joue…',
  botText: 'Il pioche, puis garde ou jette.',
  winTitle: 'Gagné, {me} contre {bot} !',
  winText: 'Tu as le plus petit total : la manche est à toi. Une vraie partie enchaîne les manches jusqu’à 100 points.',
  loseTitle: 'Raté : {me} contre {bot}',
  loseText: 'Annoncer Tamalou sans le plus petit total coûte +10. Une revanche ?',
  winLine: 'Prêt pour une vraie table ?',
  loseLine: 'La revanche t’attend.',

  noteSwapOut: 'Ta carte part sur la défausse : c’était {card}.',
  noteQuickHit: 'Une carte de moins ! Et Malo n’a rien vu venir.',
  noteQuickMiss: 'Ce n’était pas la bonne. En vrai, c’est une carte de pénalité ; on te la pardonne.',
  noteBotSwap: 'Malo échange une carte et défausse {card}.',
  noteBotDiscard: 'Malo défausse {card}.',

  actDraw: 'Piocher',
  actTake: 'Prendre la défausse',
  actCall: 'Tamalou !',
  actDiscard: 'Défausser',
  actPass: 'Laisser passer',
  actReplay: 'Rejouer cette manche',
  play: 'Jouer une vraie partie',

  movesTitle: 'Les gestes du Tamalou\u00a0:',
  moves: ['Regarder', 'Piocher', 'Échanger', 'Défausser', 'Un pouvoir', 'Défausse rapide', 'Tamalou !'],

  // How a card is named in a sentence.
  cardAce: 'un as',
  cardNumber: 'un {n}',
  cardJack: 'un Valet',
  cardQueen: 'une Dame',
  cardKing: 'un Roi {color}',
  red: 'rouge',
  black: 'noir',

  quizKicker: 'Petit test',
  quizTitle: 'Combien vaut cette main ?',
  quizSub:
    'Les têtes valent 10, l’as 1, le reste sa valeur. Et le Roi rouge ? Zéro. Le plus petit total gagne la manche.',
  quizAria: 'Ta réponse',
  quizAsk: 'Fais le compte, puis choisis.',
  quizRightKing: 'Exact ! Et tu n’as pas oublié que le Roi rouge vaut zéro.',
  quizRight: 'Exact ! Tu es prêt pour la table.',
  quizWrongKing: 'Raté : {n}. Le Roi rouge vaut zéro, pas 10.',
  quizWrong: 'Raté : {n}. Les têtes valent 10, l’as vaut 1.',
  quizNext: 'Main suivante',
  quizScore: '{good} sur {tries}',

  modesTitle: 'Ensuite, joue pour de vrai',
  modesSub:
    'Des manches qui s’enchaînent jusqu’à 100 points, contre des bots ou des humains, ou les deux à la même table.',
  modes: [
    {
      icon: 'bot',
      t: 'Seul contre des bots',
      p: 'Trois niveaux, du bot qui oublie tout à celui qui compte les cartes.',
    },
    {
      icon: 'phone',
      t: 'Sur un seul appareil',
      p: 'On se passe l’appareil. Un écran cache ton jeu entre deux joueurs.',
    },
    {
      icon: 'home',
      t: 'Sur le réseau de la maison',
      p: 'Chacun sur son appareil, sans internet : un petit serveur et un QR code.',
    },
    { icon: 'globe', t: 'En ligne', p: 'Une salle éphémère, un code ou un lien à partager. Pas de compte.' },
  ],

  bandTitle: 'Tes règles, ta table',
  bandText:
    'Le Valet ne fait pas la même chose chez toi ? Chaque règle se règle avant la partie, et se partage d’un lien. Gratuit, sans compte, marche hors ligne.',
  bandPlay: 'Jouer maintenant',

  footBy: 'Tamalou, un jeu de <a href="{url}">{name}</a>',
  footAria: 'Pied de page',
  footSource: 'Code source',
  footLegal: 'Mentions légales',

  notFoundTitle: 'Page introuvable — Tamalou',
  notFoundEyebrow: 'Erreur 404',
  notFoundHeading: 'Cette carte n’est pas dans le paquet.',
  notFoundText:
    'Cette adresse ne mène à aucune page de Tamalou : elle a peut-être changé, ou une lettre s’est glissée dedans.',
  notFoundPlay: 'Jouer',
  notFoundHome: 'Accueil',
};

export type LandingText = typeof fr;

export default fr;
