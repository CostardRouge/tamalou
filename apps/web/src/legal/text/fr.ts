/**
 * The legal notice's texts (ADR-0018), French, the source: every other language is typed against it (`LegalText`). Inserted as HTML at build time
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
  /** Above a translation (docs/plans/languages.md § 2.8): the French version prevails. Empty in French. */
  translated: '',

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
    'Une partie seul ou à plusieurs sur un seul appareil se joue entièrement dans ton navigateur&#160;: rien n’est envoyé. Le jeu garde dans le stockage local de ton navigateur, sur cet appareil seulement, la langue, les sons et vibrations, l’apparence de tes cartes, et ta dernière mise en place (mode, prénoms, nombre et niveau des bots, règles), pour la proposer la fois suivante, ainsi que ton prénom et ton avatar (une couleur et une icône), pour ne pas avoir à les choisir de nouveau&#160;; en rejoignant une salle, ton prénom et ton avatar sont montrés aux autres joueurs de cette salle&#160;; la liste de tes parties finies sur cet appareil (date, mode, prénoms des autres joueurs, ta place, tes points, tes Tamalou), pour «&#160;Mes parties&#160;», que tu peux sauvegarder dans un fichier et restaurer&#160;; si tu joues en ligne, un jeton par salle pendant un jour, pour reprendre ta place après une coupure&#160;; et le numéro tiré au hasard des statistiques de jeu (plus bas), tant que «&#160;Reconnaître cet appareil&#160;» est activé dans les réglages.',
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
  count5:
    '<b>Statistiques de jeu.</b> Le jeu en ligne envoie aussi au serveur de Tamalou, sur Cloudflare, un court rapport anonyme quand une partie commence ou finit et quand une salle est créée ou rejointe&#160;: le mode, le nombre de joueurs, d’humains et de bots, le niveau des bots, le préréglage et si des règles ont été changées, le nombre de manches, la durée en minutes, si tu as gagné une partie seul, la façon d’entrer dans une salle (QR code, lien ou code tapé), et comment ton appareil est réglé (langue, type d’appareil, orientation, type de connexion, jeu installé ou non, son, vibrations, disposition de la main, affichage de la carte piochée, rythme des bots, vitesse des cartes). Le serveur n’y ajoute que le jour et l’heure, à la minute près. Une partie porte un numéro tiré au hasard pour elle seule, qui relie son début et sa fin&#160;: deux parties d’un même appareil ont des numéros sans rapport. Pour savoir combien d’appareils reviennent jouer, un rapport porte aussi un numéro que ton appareil a tiré au hasard et garde&#160;: il ne dit rien de toi, ne sert qu’à ces statistiques, est remplacé par un nouveau au bout de 13 mois, et s’arrête et s’efface quand tu coupes «&#160;Reconnaître cet appareil&#160;» dans les réglages du jeu. Ni prénom, ni code de salle, ni adresse IP. Seul l’éditeur les lit, en chiffres d’ensemble, pour améliorer le jeu&#160;; ils sont effacés au bout de 13 mois. Le même choix les arrête&#160;: rien n’est envoyé quand le compteur est coupé ci-dessous, ou que ton navigateur demande à ne pas être suivi. Une partie sur GitHub Pages ou sur le réseau local n’envoie rien.',
  count4:
    'Le compteur n’est même pas chargé quand ton navigateur envoie <i>Do Not Track</i> ou <i>Global Privacy Control</i>, ou quand tu le coupes ci-dessous&#160;; ce choix est gardé dans ce navigateur.',
  countOn: 'Tes visites sont comptées, anonymement, dans ce navigateur.',
  countOff: 'Tes visites ne sont pas comptées dans ce navigateur.',
  countSignal: 'Ton navigateur demande à ne pas être suivi&#160;: tes visites ne sont pas comptées.',
  countNone: 'Cette copie de Tamalou ne compte pas les visites.',
  countStop: 'Ne plus compter mes visites',
  countResume: 'Compter à nouveau mes visites',

  cookiesTitle: 'Cookies',
  cookies1:
    'Tamalou ne dépose aucun cookie chez ses joueurs, donc pas de bandeau de consentement&#160;: il n’y a rien à accepter. Seule la page d’administration de l’éditeur en pose un, pour sa propre session.',

  logsTitle: 'Hébergement et abus',
  logs1:
    'Comme tout hébergeur, Cloudflare (et GitHub pour la copie) traite ton adresse IP pour délivrer les pages et protéger le site&#160;: voir la <a href="https://www.cloudflare.com/privacypolicy/">politique de confidentialité de Cloudflare</a>. Tamalou s’en sert pour limiter le nombre de salles qu’une même adresse peut créer par minute, sans la garder. Cloudflare conserve quelques jours des journaux techniques des appels au serveur, que l’éditeur consulte pour corriger les erreurs.',

  rightsTitle: 'Tes droits',
  rights1:
    'Le RGPD te permet de demander l’accès aux données qui te concernent ou leur effacement. Tamalou n’en garde aucune qui te nomme&#160;: tes réglages sont sur ton appareil, une salle en ligne s’efface d’elle-même, et les statistiques de jeu sont anonymes. Pour toute question ou demande, écris à {email}&#160;; tu peux aussi adresser une réclamation à la <a href="https://www.cnil.fr">CNIL</a>.',

  licenceTitle: 'Licence',
  licence1:
    'Tamalou est un logiciel libre&#160;: son <a href="{source}">code source</a> est publié sous <a href="{license}">licence MIT</a>. Le Tamalou est un jeu de cartes traditionnel&#160;; ses règles n’appartiennent à personne.',

  liabTitle: 'Responsabilité',
  liab1:
    'Tamalou est fourni tel quel, de bonne foi, sans garantie d’aucune sorte. Les liens vers d’autres sites sont donnés par commodité&#160;; leur contenu leur appartient. Quelque chose ici porte atteinte à un de tes droits&#160;? Écris à {email}, et ce sera corrigé.',
};

export type LegalText = typeof fr;

export default fr;
