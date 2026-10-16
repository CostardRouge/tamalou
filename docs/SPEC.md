# Tamalou — spécification

Le brief d'origine du projet (2026-10-16), tenu à jour au fil des décisions. Chaque amendement est marqué **[ADR-NNNN]** et renvoie à `docs/DECISIONS.md`, qui en garde le contexte, la décision et les alternatives écartées.

---

## 0. Mode de travail

1. **Commencer en mode plan.** Avant d'écrire du code, proposer la stack, l'architecture et le découpage en milestones, puis attendre la validation.
2. **Le dépôt** `CostardRouge/tamalou` : le brief le voulait privé pour l'instant, mais il a été créé **public** (constaté le 2026-10-16 par le job `check` de `registry.yml`) ; c'est au propriétaire de le passer en privé ou non. Il porte un README, un `.gitignore`, la licence MIT et un `CLAUDE.md` avec les conventions du projet. Il suit la spec commune du portfolio (`COMMON-PROJECT-SPEC.md` dans `second-brain`) : `MEMORY.md`, `docs/memory/`, `AGENTS.md`, `/memorize`, `registry.yml`. *(Amendé : le dépôt existait déjà, vide ; il n'a pas été créé avec `gh repo create`.)*
3. **Cette spécification** vit dans `docs/SPEC.md` et reste à jour. Chaque choix structurant est consigné dans `docs/DECISIONS.md` (format ADR court : contexte, décision, alternatives écartées).
4. **Conventions :**
   - Le code, les commits et les noms techniques sont en anglais.
   - L'interface est en français, avec une i18n simple pour ajouter l'anglais plus tard.
5. **Cadence :**
   - Des petits commits. **[ADR-0001]** Format de la spec commune (C3) : titre impératif en anglais, sans préfixe `feat:`, et non Conventional Commits.
   - Une milestone à la fois.
   - Chaque milestone est jouable ou testable avant de passer à la suivante.
6. **Questions :** demander quand une règle est ambiguë. Ne jamais inventer une règle en silence : la mettre en paramètre, avec la valeur par défaut décrite ici.
7. **Présentation :** montrer des résultats (une démo, un écran, des tests qui passent) plutôt que de longues explications.

---

## 1. Vision

- Un jeu de Tamalou fidèle aux parties « à la maison », agréable sur mobile.
- Le **maître de jeu** (l'hôte de la partie) peut **configurer toutes les règles** avant de lancer : valeurs, pouvoirs, pénalités, fin de partie, etc. Les variantes plus exotiques viendront plus tard, mais l'architecture doit déjà les permettre.
- Il y a **4 modes de jeu** :
  1. **Solo** contre des bots.
  2. **Écran partagé / pass-and-play** : plusieurs joueurs sur un même appareil, qu'on se passe.
  3. **Multi LAN** : chacun sur son téléphone, sur le même réseau local, sans dépendre d'internet.
  4. **Multi en ligne** : sessions de jeu **temporaires**. On les rejoint via un code ou un lien, sans compte.
- Les modes peuvent se mélanger. Par exemple, une partie en ligne peut combiner des humains et des bots.

---

## 2. Règles de base (valeurs par défaut)

Toutes les valeurs ci-dessous sont des **défauts configurables** (voir §3).

### Matériel
- Jeu de 52 cartes. Les jokers sont optionnels et désactivés par défaut.
- 2 à 6 joueurs. Au-delà de 4, 2 paquets en option.

### Valeurs des cartes
| Carte | Valeur |
|---|---|
| As | 1 |
| 2 à 10 | valeur faciale |
| Valet, Dame, Roi | 10 |
| Roi rouge (♥ ♦) | 0 |
| Joker (si activé) | configurable, défaut -1 |

### Mise en place
- Chaque joueur reçoit **4 cartes face cachée**, disposées en grille 2×2.
- Au début de la manche, chaque joueur **regarde 2 de ses cartes** (par défaut, les 2 du bas), puis les garde en mémoire.
- On retourne une carte de la pioche pour lancer la défausse.

### Tour de jeu
À son tour, un joueur :
1. **Pioche**, au choix :
   - la carte du dessus de la **pioche** (face cachée, lui seul la voit) ;
   - ou la carte du dessus de la **défausse** (visible de tous).
2. Puis, au choix :
   - **échange** la carte piochée avec une de ses cartes. Il pose la carte remplacée sur la défausse, face visible ;
   - **ou défausse** directement la carte piochée. Cette option n'existe que si la carte vient de la pioche. Une carte prise dans la défausse doit être échangée.

### Pouvoirs
Un pouvoir s'active **seulement si la carte vient de la pioche et est défaussée directement** (pas si elle sort d'un échange). Le joueur peut toujours choisir de ne pas l'utiliser.

| Carte | Pouvoir |
|---|---|
| 7, 8 | Regarder une de ses propres cartes |
| 9, 10 | Regarder une carte d'un adversaire |
| Valet | Échanger à l'aveugle une de ses cartes avec celle d'un adversaire |
| Dame | Regarder une carte (la sienne ou celle d'un adversaire), puis décider d'échanger ou non |
| Roi | Aucun pouvoir par défaut |

**[ADR-0006]** Un pouvoir se résout **avant** toute défausse rapide sur la carte qui l'a déclenché.

### Défausse rapide
- À tout moment, même hors de son tour, **n'importe quel joueur** peut poser une de ses cartes si elle a **le même rang** que la carte du dessus de la défausse. Il a alors une carte de moins.
- **Erreur** (la carte ne correspond pas) : la carte retourne à sa place, et le joueur prend **1 carte de pénalité** de la pioche, face cachée, sans la regarder. **[ADR-0006]** Cette carte ouvre une case de plus dans sa grille.
- **Concurrence** : si plusieurs joueurs défaussent en même temps, seul **le premier validé par le serveur** est accepté. Pour les autres, la carte de dessus a changé et leur action est annulée sans pénalité.
- **[ADR-0005]** **Fenêtre** : elle s'ouvre quand une carte arrive face visible sur la défausse et se ferme quand le joueur suivant pioche, avec un minimum de 2 s. En pass-and-play, la défausse rapide est **désactivée par défaut** (activable).
- Option (désactivée par défaut) : défausser la carte d'un **adversaire** si elle correspond. On lui donne alors une de ses propres cartes en échange.

### Fin de manche : « Tamalou ! »
- Un joueur peut annoncer **« Tamalou »**. Par défaut, il le fait **à la place de son tour**, au début de celui-ci.
- Chaque autre joueur joue ensuite **un dernier tour**.
- Option (activée par défaut) : les cartes du joueur qui a annoncé Tamalou sont **verrouillées**. Les pouvoirs des autres ne peuvent pas les toucher. **[ADR-0006]** Il peut encore faire des défausses rapides.
- Toutes les cartes sont ensuite révélées et on compte les points.
- Si le joueur qui a annoncé **n'a pas strictement le plus petit total**, il prend une pénalité. Par défaut, **+10 points**. Ce montant est configurable, avec aussi l'option « score doublé ». **[ADR-0006]** Une égalité compte donc comme un échec.
- Option : un bonus au joueur qui annonce et gagne, par exemple son score de manche ramené à 0.

### Fin de partie
- Les scores s'additionnent d'une manche à l'autre.
- Un joueur est éliminé quand il **atteint ou dépasse 100**.
- La partie se termine quand il ne reste qu'un joueur. Variante : elle se termine au premier éliminé, et le plus petit total gagne.
- Option : jouer un nombre fixe de manches au lieu d'un seuil.
- **[ADR-0006]** Égalité en fin de partie : les joueurs à égalité partagent la victoire.

### Cas limites à gérer
- **Pioche vide** : on mélange la défausse, sauf la carte du dessus, pour reformer la pioche. **[ADR-0006]** Si elle reste vide, les cartes de pénalité manquantes sont sautées (provisoire, à confirmer).
- **Main vide** : un joueur qui n'a plus aucune carte a 0 point. Option : il déclenche automatiquement la fin de manche.
- **Égalités** en fin de manche et en fin de partie. Le comportement est défini et configurable.
- **Joueur déconnecté ou inactif** : un timer de tour (optionnel) est suivi d'un auto-play par un bot.

---

## 3. Règles configurables (le cœur du projet)

- Les règles sont un **objet `RuleSet` typé et versionné**, validé avec un schéma Zod, avec des valeurs par défaut.
- Le moteur ne contient **jamais** de règle codée en dur : il lit le `RuleSet`.
- **[ADR-0008]** Le moteur n'a pas d'horloge : la durée minimale de la fenêtre de défausse rapide et le timer de tour sont appliqués par l'hôte (le navigateur ou le serveur), pas par le moteur.
- Des **presets** : « Classique » (les règles ci-dessus), « Rapide », etc. Un preset est un `RuleSet` partiel fusionné avec les défauts.
- Paramètres attendus, au minimum :
  - **Paquet :** nombre de paquets, jokers oui/non, valeur du joker.
  - **Valeurs :** valeur de chaque rang, valeur spéciale du Roi rouge (ou de toute autre carte).
  - **Main :** taille de la main, nombre et position des cartes vues au départ, disposition.
  - **Pouvoirs :** une table rang → pouvoir. Les pouvoirs disponibles sont `peekOwn`, `peekOther`, `blindSwap`, `peekThenSwap`, `none`. La table reste extensible pour de futurs pouvoirs.
  - **Activation des pouvoirs :** seulement depuis la pioche, ou aussi depuis la défausse.
  - **Défausse rapide :** activée ou non, pénalité d'erreur (nombre de cartes), autorisation de défausser la carte d'un adversaire.
  - **Prise dans la défausse :** échange obligatoire ou non.
  - **Tamalou :** moment de l'annonce, verrouillage des cartes, pénalité en cas d'échec (+N ou ×2), bonus en cas de victoire, tour minimum avant de pouvoir annoncer (**[ADR-0006]** 0 par défaut).
  - **Fin de partie :** seuil d'élimination, ou nombre de manches, et mode de victoire.
  - **Rythme :** timer de tour (off / N secondes), délai de la fenêtre de défausse rapide.
- **Interface du maître de jeu :** un écran de lobby pour :
  - choisir un preset ;
  - modifier chaque paramètre, avec une description claire en français ;
  - voir un résumé lisible des règles actives.
  Tous les joueurs peuvent consulter les règles pendant la partie.
- Le `RuleSet` peut être **exporté et importé en JSON**, ou partagé par lien. **[ADR-0011]** Le lien porte le preset et seulement les réglages modifiés, dans le fragment (`#rules=…`).
- **[M4]** Chaque réglage a sa ligne à l'écran du maître de jeu, avec une aide en français ; un test échoue si une règle n'en a pas. Le résumé signale ce qui diffère du Classique.

---

## 4. Architecture

Principes non négociables :

1. **Moteur de jeu pur et isolé** (package `engine`) :
   - TypeScript, sans aucune dépendance UI ou réseau.
   - Approche *reducer* / event sourcing : `(state, action, rules) → { state, events }`.
   - RNG **seedé** : une partie est rejouable à partir de sa seed et de la liste des actions.
   - **Information cachée** : `viewFor(state, playerId)` produit la vue filtrée de chaque joueur. Elle ne contient que les cartes que ce joueur a le droit de connaître.
2. **Le même moteur sert partout** :
   - **Solo** et **pass-and-play** : il tourne dans le navigateur, sans serveur.
   - **En ligne** et **LAN** : il tourne sur le serveur, qui fait **autorité**. Les clients n'envoient que des intentions, et le serveur ne leur renvoie que leur vue filtrée.
3. **Couche transport abstraite** : le client parle à une interface `GameConnection`, avec deux implémentations, `LocalConnection` (moteur dans le navigateur) et `RemoteConnection` (WebSocket). L'UI ne fait aucune différence entre les deux.
4. **Monorepo** pnpm **[ADR-0002]** :
   - `packages/shared` : types et schémas ;
   - `packages/engine` : le moteur ;
   - `packages/bots` : les bots et la CLI de simulation ;
   - `packages/room` : la logique de salle, pure (sièges, tokens, lobby, timers, relais par un bot, expiration) **[ADR-0004]**. Son `Table` est l'hôte de toute partie, dans le navigateur comme sur un serveur **[ADR-0009]** ;
   - `apps/web` : l'interface ;
   - `apps/server` : le serveur Node du mode LAN, qui sert aussi l'app web ;
   - `apps/worker` : le Worker Cloudflare et ses Durable Objects pour le mode en ligne **[ADR-0004]**.

Stack retenue :
- **Front [ADR-0003] :** TypeScript, React 19, Vite, mobile-first. Animations de cartes avec Motion (ex-Framer Motion) : distribution, retournement, échange, défausse.
- **Serveurs [ADR-0004] :** Cloudflare Durable Objects en ligne (une salle = un objet) ; Node + `ws` pour le LAN. Les deux ne sont que des adaptateurs de `packages/room`.
- **Tests :** Vitest, fast-check.
- **Charte graphique [ADR-0007] :** celle de Versus (tokens, thèmes clair et sombre, polices).

---

## 5. Les modes en détail

### 5.1 Solo contre bots
- Le joueur choisit de 1 à 5 bots.
- Il y a **3 niveaux** :
  - **Facile** : le bot joue au hasard, mais ses coups restent légaux.
  - **Moyen** : il a une mémoire imparfaite des cartes vues et utilise une heuristique simple.
  - **Difficile** : il a une bonne mémoire, estime les cartes inconnues par probabilité, utilise les pouvoirs de façon stratégique et choisit le bon moment pour annoncer Tamalou.
- Un bot ne voit **que sa propre vue** (`viewFor`), exactement comme un humain.
- Ses actions sont temporisées pour qu'on puisse suivre la partie, et ses défausses rapides ont un délai réaliste.

### 5.2 Écran partagé / pass-and-play
- Les joueurs sont sur un seul appareil (téléphone ou tablette).
- Un **écran de transition** s'affiche entre chaque tour : « Passe le téléphone à Vanessa », avec un tap pour révéler la vue du joueur. Rien de privé n'est visible pendant le passage de main.
- **[ADR-0005]** La défausse rapide y est désactivée par défaut ; le maître de jeu peut l'activer. **[ADR-0012]** Activée, on choisit qui réclame, puis sa carte, qui reste face cachée.
- **[ADR-0012]** Pendant le tour d'un bot ou entre deux manches, l'écran montre la table sans aucune carte privée.
- Les bots sont possibles dans ce mode aussi.

### 5.3 Multi en ligne : sessions temporaires
- **Créer une partie** génère :
  - un **code court** de 4 à 6 caractères, sans caractères ambigus ;
  - un **lien de partage** ;
  - un **QR code**.
- **Rejoindre :** le joueur saisit le code ou ouvre le lien, puis entre un pseudo. Aucun compte.
- **Lobby :**
  - le créateur est le **maître de jeu** : il configure le `RuleSet`, ajoute ou retire des bots, peut exclure un joueur et lance la partie ;
  - on voit la liste des joueurs avec leur statut « prêt ».
- **Reconnexion :** un token de session est stocké en local. Si on recharge la page ou qu'on perd le réseau, on revient à sa place. Pendant la déconnexion, le joueur est marqué absent, et après un délai, un bot prend le relais.
- **Durée de vie :** une session est **éphémère**. Elle vit en mémoire côté serveur, est détruite après une période d'inactivité (défaut 2 h) ou à la fin de la partie, et aucune donnée n'est persistée. *(Sur Durable Objects : l'état de la salle peut passer par le stockage de l'objet pour survivre à une éviction, et une alarme l'efface à l'expiration ; rien ne survit à la salle.)*
- **Rejouer :** on peut enchaîner une nouvelle partie avec les mêmes joueurs et les mêmes règles.
- Option : des spectateurs, qui ne voient que les informations publiques.

### 5.4 Multi LAN
- Le même protocole que le mode en ligne, servi **localement** par `apps/server` (Node) :
  - une commande `pnpm serve:lan` ;
  - **et** une image Docker / un `docker-compose.yml`, pour le homelab (Dell Optiplex sous Ubuntu Server, Portainer).
- Au démarrage, le serveur affiche son **IP locale** avec une URL et un QR code à scanner.
- L'app web est servie par ce même serveur pour que ça marche sans internet.

---

## 6. UX / UI

- **Mobile-first**, en portrait. Agréable aussi sur desktop et sur tablette.
- **Table :** ma grille de cartes en bas ; les adversaires autour ; la pioche et la défausse au centre.
- **Lisibilité :** les actions possibles sont toujours claires, les actions illégales désactivées ; un indicateur montre à qui c'est le tour.
- **Peek** : la carte se retourne quelques secondes, **visible uniquement par le joueur concerné**. Les autres voient seulement qu'une carte a été regardée et laquelle.
- **Journal de partie public** : « Steeve a pioché dans la défausse », « Vanessa a utilisé un Valet », etc.
- **Fin de manche :** révélation animée des cartes, décompte des points, tableau des scores cumulés.
- **Pas d'aide-mémoire** affichant les cartes vues. Option du maître de jeu : un mode « débutant » qui les affiche.
- **Sons** légers, désactivables, et retours haptiques sur mobile.
- **Accessibilité :** les couleurs ne sont jamais le seul indice ; les cartes ont un libellé lisible par les lecteurs d'écran.
- **Design des cartes :** une première version propre et sobre, isolée derrière un composant / thème, pour brancher plus tard les jeux de cartes du propriétaire.

---

## 7. Qualité et tests

- **Moteur :** tests unitaires exhaustifs (chaque règle, chaque pouvoir, chaque cas limite) et tests property-based (fast-check) avec ces invariants :
  - le nombre total de cartes est constant ;
  - aucune carte n'est dupliquée ;
  - une vue filtrée ne contient aucune information interdite.
- **Simulations bot contre bot** : des milliers de parties en CLI, pour détecter les blocages et les crashs, et comparer les niveaux de bots.
- **Rejeu :** une partie se rejoue depuis sa seed et ses actions.
- **Serveur :** des tests d'intégration multi-clients, sur la concurrence de la défausse rapide et la reconnexion.
- **CI** GitHub Actions avec lint, typecheck et tests.

---

## 8. Milestones

| # | Contenu | Critère de fin |
|---|---|---|
| **M0** | Repo, monorepo, CI, `CLAUDE.md`, `docs/SPEC.md`, mise aux normes de la spec commune, fiche du registre | La CI est verte |
| **M1** | Moteur pur avec le `RuleSet` complet et les tests | Tous les tests passent, une simulation CLI de parties aléatoires tourne |
| **M2** | Bots (3 niveaux) | Les simulations bot contre bot montrent que « difficile » bat nettement « facile » |
| **M3** | UI web solo contre bots, jeu d'icônes complet (C11), publication sur GitHub Pages **[ADR-0010]** | Une partie complète sur téléphone |
| **M4** | Écran de configuration du maître de jeu et presets | N'importe quelle règle se modifie et s'applique |
| **M5** | Mode pass-and-play | Une partie à 2 ou 3 sur un seul appareil |
| **M6** | `packages/room`, Worker + Durable Objects, multi en ligne (salles, lobby, reconnexion, expiration) | Une partie à 3 sur 3 téléphones via un lien |
| **M7** | Mode LAN (`apps/server`) et Docker | La partie fonctionne sur le réseau local sans internet |
| **M8** | Finitions : animations, sons, i18n, PWA installable | Le jeu est agréable à utiliser |

Plus tard, hors périmètre pour l'instant : les variantes de règles avancées, les designs de cartes du propriétaire, les statistiques et l'historique des parties.
