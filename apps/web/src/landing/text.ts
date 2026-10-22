/**
 * The home page's texts (ADR-0017), French first and English typed against it, so a missing key fails the typecheck.
 * Read at build time (src/landing/markup.ts writes the page) and in the browser (the first round and the quiz): plain
 * data, no import. Inline markup (<em>) is inserted as is in the page; texts the scripts draw stay plain, with
 * ` ` for no-break spaces (never an HTML entity). Placeholders: {card}, {value}, {n}, {me}, {bot}…
 */

const fr = {
  title: 'Tamalou — le jeu de cartes de mémoire et de bluff, à jouer en ligne',
  description:
    'Joue ta première manche de Tamalou en une minute, ici même : quatre cartes face cachée, de la mémoire et du bluff, le plus petit total gagne. Seul contre des bots, à plusieurs sur un téléphone, en Wi-Fi ou en ligne. Gratuit, sans compte.',
  navAria: 'Sections',
  navRound: 'La manche',
  navValues: 'Les valeurs',
  navModes: 'Modes',
  navPlay: 'Jouer',
  otherLang: 'English',
  otherLangShort: 'EN',

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
      t: 'Sur un seul téléphone',
      p: 'On se passe l’appareil. Un écran cache ton jeu entre deux joueurs.',
    },
    {
      icon: 'home',
      t: 'Sur le réseau de la maison',
      p: 'Chacun sur son téléphone, sans internet : un petit serveur et un QR code.',
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
};

export type LandingText = typeof fr;

const en: LandingText = {
  title: 'Tamalou — the memory and bluffing card game, to play online',
  description:
    'Play your first round of Tamalou in one minute, right here: four face-down cards, memory and bluff, the lowest total wins. Solo against bots, around one phone, on your Wi-Fi or online. Free, no account.',
  navAria: 'Sections',
  navRound: 'The round',
  navValues: 'Card values',
  navModes: 'Modes',
  navPlay: 'Play',
  otherLang: 'Français',
  otherLangShort: 'FR',

  eyebrow: 'Learn by playing · one minute',
  heroTitle: 'Your first round of Tamalou, <em>right here.</em>',
  heroLead:
    'No rules to read: Malo, a not-so-clever bot, is waiting. Follow the guide, and call “Tamalou!” when you think your total is the lowest.',

  roundAria: 'A practice round against a bot',
  bot: 'Malo',
  you: 'You',
  piles: ['Deck', 'Discard'],
  splash: 'Tamalou!',
  where: ['far left', 'middle left', 'middle right', 'far right'],
  yourSlot: 'Your card {where}',
  botSlot: 'Malo’s card {where}',
  points: '{who}: {n}',

  tagTurn: 'Your turn · {n}',
  tagBot: 'Malo’s turn',
  tagLast: 'Last turn',
  tagEnd: 'End of the round',
  peekTitle: 'Remember your two right-hand cards',
  peekText: 'Tap them to look. They will turn back over: memory is the whole game.',
  waitTitle: 'Remember…',
  waitText: 'What you see will not stay on screen for long.',
  calledTitle: 'Tamalou!',
  calledText: 'Malo plays one last turn, then every card is turned over.',
  turnTitle: 'Your move',
  turnFirst: 'Draw an unknown card, or take the visible one on the discard pile: {card}, worth {value}.',
  turnNext: 'Draw, take the discard ({card}), or call “Tamalou!” if you think your total is the lowest.',
  lowTitle: 'The deck is nearly empty',
  lowText: 'In this practice round, now is the time: call “Tamalou!”.',
  takeTitle: 'You take {card}',
  takeText: 'A card taken from the discard must be kept: tap the card it replaces.',
  drawTitle: 'You draw {card}',
  drawPeekOwn: 'Discard it right away: its power lets you look at one of your cards. Or keep it by tapping a card.',
  drawPeekOther: 'Discard it to look at one of Malo’s cards, or keep it by tapping one of yours.',
  drawLow: 'A low card: keep it. Tap one of your left-hand cards, the ones you do not know.',
  drawOther: 'Keep it by tapping the card it replaces, or discard it.',
  powerOwnTitle: 'Power: look at one of your cards',
  powerOwnText: 'Tap one you do not know yet.',
  powerOtherTitle: 'Power: look at one of Malo’s cards',
  powerOtherText: 'Tap one of his cards. Knowing what he hides helps you pick the moment to say Tamalou.',
  quickTitle: 'Quick discard!',
  quickText: 'Malo just threw {card}. You have one of the same rank and you know where: tap it, quick.',
  botTitle: 'Malo is playing…',
  botText: 'He draws, then keeps or throws.',
  winTitle: 'You win, {me} to {bot}!',
  winText: 'Yours is the lowest total: the round is yours. A real game chains rounds up to 100 points.',
  loseTitle: 'Missed: {me} to {bot}',
  loseText: 'Calling Tamalou without the lowest total costs +10. Rematch?',
  winLine: 'Ready for a real table?',
  loseLine: 'Your rematch is waiting.',

  noteSwapOut: 'Your card goes to the discard pile: it was {card}.',
  noteQuickHit: 'One card fewer! Malo never saw it coming.',
  noteQuickMiss: 'Not that one. In a real game, that is a penalty card; this time it is forgiven.',
  noteBotSwap: 'Malo swaps a card and discards {card}.',
  noteBotDiscard: 'Malo discards {card}.',

  actDraw: 'Draw',
  actTake: 'Take the discard',
  actCall: 'Tamalou!',
  actDiscard: 'Discard',
  actPass: 'Let it go',
  actReplay: 'Play this round again',
  play: 'Play a real game',

  movesTitle: 'The moves of Tamalou:',
  moves: ['Peek', 'Draw', 'Swap', 'Discard', 'A power', 'Quick discard', 'Tamalou!'],

  cardAce: 'an ace',
  cardNumber: 'a {n}',
  cardJack: 'a Jack',
  cardQueen: 'a Queen',
  cardKing: 'a {color} King',
  red: 'red',
  black: 'black',

  quizKicker: 'Quick test',
  quizTitle: 'What is this hand worth?',
  quizSub:
    'Face cards are worth 10, the ace 1, the rest their number. And the red King? Zero. The lowest total wins the round.',
  quizAria: 'Your answer',
  quizAsk: 'Add it up, then pick.',
  quizRightKing: 'Right! And you remembered the red King is worth zero.',
  quizRight: 'Right! You are ready for the table.',
  quizWrongKing: 'Missed: {n}. The red King is worth zero, not 10.',
  quizWrong: 'Missed: {n}. Face cards are worth 10, the ace 1.',
  quizNext: 'Next hand',
  quizScore: '{good} out of {tries}',

  modesTitle: 'Then play for real',
  modesSub: 'Rounds that follow one another up to 100 points, against bots or humans, or both at the same table.',
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

  bandTitle: 'Your rules, your table',
  bandText:
    'The Jack does something else at your place? Every rule can be set before the game, and shared with a link. Free, no account, works offline.',
  bandPlay: 'Play now',

  footBy: 'Tamalou, a game by <a href="{url}">{name}</a>',
  footAria: 'Footer',
  footSource: 'Source code',
  footLegal: 'Legal notice',
};

export const LANDING: Record<'fr' | 'en', LandingText> = { fr, en };

/** "{x} and {y}" → the values given. */
export const fill = (s: string, values: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));

/** A card in a sentence: "un Roi rouge", "an 8". */
export function cardWords(t: LandingText, c: { rank: string; suit: string | null }): string {
  if (c.rank === 'A') return t.cardAce;
  if (c.rank === 'J') return t.cardJack;
  if (c.rank === 'Q') return t.cardQueen;
  if (c.rank === 'K') return fill(t.cardKing, { color: c.suit === 'H' || c.suit === 'D' ? t.red : t.black });
  // English says "an 8"; French has no such case.
  if (c.rank === '8' && t.cardNumber === 'a {n}') return 'an 8';
  return fill(t.cardNumber, { n: c.rank });
}
