# Tamalou — pistes après le jeu entre amis

Les idées remontées par les premiers joueurs et par le propriétaire (2026-11-27) : multijoueur international, classement, matchmaking, gamification, application mobile, marketing. Ce document les **liste et les évalue** ; rien n'est décidé. Chaque piste lancée devient une session à part, qui part de sa section (« Pour lancer la session ») et, si elle tranche un choix structurant, finit en ADR dans `docs/DECISIONS.md`.

Pour lire le tableau : **coût** = travail d'agent + temps du propriétaire (tests, décisions) + argent récurrent ; **population** = joueurs nécessaires pour que ça marche.

| # | Piste | Coût | Population | Touche à une décision ? |
|---|---|---|---|---|
| 1 | Défi du jour et défi entre amis | faible | aucune | non |
| 2 | Parcours solo, succès, déblocages | moyen | aucune | non |
| 3 | Tutoriel des pouvoirs dans le jeu | faible | aucune | non |
| 4 | Identité légère (pseudo durable) | moyen | — | **oui** : ADR-0024, ADR-0025, C18 |
| 5 | Classement Elo / OpenSkill | moyen | moyenne | dépend de 4 |
| 6 | Matchmaking public | élevé | **forte** | dépend de 4 et 5 |
| 7 | Parties asynchrones + notifications | élevé | faible | règles : défausse rapide coupée |
| 8 | International (langues) | faible à moyen | — | non |
| 9 | Marketing et acquisition | temps surtout | — | non |
| 10 | Applications des stores | moyen + 99 €/an (Apple) | — | non |

**Ordre recommandé** : 1 → 2/3 → 9 (en continu, dès que 1 donne quelque chose à partager) → 4 → 5 → 7 → 6, et 10 en bonus. La raison tient en une phrase : tout ce qui marche **sans population** passe d'abord, parce qu'au début il n'y aura personne dans une file d'attente, et une file vide tue un jeu plus sûrement qu'une absence de classement. Les statistiques d'usage (ADR-0024, `/admin/`) diront quand la population justifie 5 et 6.

---

## 1. Défi du jour et défi entre amis

**L'idée** : une « Partie du jour », la même pour tout le monde (même mélange, mêmes bots, mêmes règles), comme Wordle ; on joue, on obtient un score, on partage un résultat court (emoji + lien) ; et « Défie un ami » : la même donne envoyée par lien, chacun joue de son côté, on compare.

**Ce qui existe déjà** : le moteur est déterministe — une partie se rejoue depuis sa seed et ses actions (`packages/engine/src/replay.ts`) ; les règles voyagent déjà par lien (`#rules=`, ADR-0011) ; les bots jouent seuls dans le navigateur.

**Ce que ça demande** : une seed du jour dérivée de la date (aucun serveur pour jouer) ; un écran de résultat partageable (image + texte) ; un lien `#defi=` (seed + règles) ; plus tard, un classement du jour côté Worker, où le serveur **rejoue** les actions envoyées pour vérifier le score (triche difficile, puisque la vérification est exacte).

**Pourquoi d'abord** : viral (chaque partage est une invitation), quotidien (une raison de revenir), sans compte, sans population, et ça réutilise l'architecture telle qu'elle est.

**Questions pour toi** : quel score compte (points de la manche, une partie en plusieurs manches, victoire contre les bots) ? un seul défi par jour ou plusieurs niveaux ? les bots du défi sont-ils au niveau moyen ?

## 2. Parcours solo, succès, déblocages

**L'idée** : une carte de progression contre des bots de plus en plus forts, avec des étoiles par étape (« gagne », « gagne en appelant Tamalou », « finis sous 5 points ») ; des succès (« premier Tamalou », « défausse rapide sur une carte adverse ») ; des récompenses **cosmétiques** : dos de cartes, motifs, effets, avatars.

**Ce qui existe déjà** : trois niveaux de bots (`packages/bots`), la personnalisation des cartes (« Tes cartes ») et des avatars (ADR-0025), l'historique « Mes parties » sur l'appareil. Les récompenses existent donc déjà : il suffit d'en verrouiller une partie.

**Ce que ça demande** : un niveau de bot intermédiaire ou plus fin (régler `PROFILES`), un écran de parcours, des succès lus dans les événements de la partie (logique pure dans `packages/`), une progression gardée sur l'appareil et sauvegardée avec « Mes parties ».

**Addictif sans être toxique** : séries de jours (avec un joker pour un jour manqué), objectifs courts, récompenses visibles. Pas de loterie ni de coffre aléatoire (réglementés dans plusieurs pays), rien à acheter, pas de notifications culpabilisantes.

**Questions pour toi** : verrouiller des cosmétiques qui sont aujourd'hui libres, ou n'en ajouter que de nouveaux ? combien d'étapes pour un premier parcours (10 ? 20 ?) ?

## 3. Tutoriel des pouvoirs dans le jeu

**L'idée** : la première manche guidée de la page d'accueil (ADR-0017) apprend les bases ; il manque les pouvoirs (regarder, échanger), la défausse rapide et l'appel « Tamalou ! ». Une suite de petites leçons jouées, qui peut devenir les premières étapes du parcours (2).

**Ce qui existe déjà** : `tutorial.ts`, un réducteur pur sur un paquet fixé, et le quiz des mains.

**Question pour toi** : leçons séparées dans le jeu, ou suite du parcours d'accueil ?

## 4. Identité légère (prérequis du classement)

**Le point dur** : un classement suppose de **reconnaître un joueur d'une partie à l'autre**. Or le projet a refusé jusqu'ici tout compte et tout identifiant d'appareil (ADR-0024, ADR-0025), et ne garde rien à sauvegarder (C18). C'est une décision à rouvrir explicitement.

**Option recommandée** : un pseudo + une clé générée sur l'appareil (aucun e-mail, aucun mot de passe), récupérable par un code ou par le fichier de « Mes parties », et une passkey plus tard pour passer d'un téléphone à l'autre. Sésame ne convient pas au public (il demande une invitation par personne).

**Ce que ça entraîne** : une base côté Worker (D1 ou un Durable Object SQLite), des sauvegardes, la mention légale et le RGPD (un pseudo public est une donnée personnelle), et la **modération des pseudos** affichés dans un classement — un coût humain réel.

**Questions pour toi** : accepter un serveur qui garde des joueurs ? pseudo libre ou choisi dans une liste (zéro modération) ?

## 5. Classement Elo

**Évaluée le 2026-11-27, avec les pistes 4 et 6** : `docs/plans/ranking.md` (identité, stockage, RGPD, OpenSkill, règles classées, pièges, coût, questions, étapes). Décidée le jour même : **ADR-0029** (classement contre les bots d'abord, étapes R0–R3).

**Le choix technique** : l'Elo classique est fait pour le face-à-face ; Tamalou se joue à 2–6. Pour du chacun-pour-soi à plusieurs, **OpenSkill** (Weng-Lin, libre, bibliothèque JS) fait ce que TrueSkill fait, sans ses brevets ; Glicko-2 si on se limite au un-contre-un. Le classement se calcule sur l'ordre final d'une partie.

**Les pièges** : la collusion (deux amis à la même table classée qui se parlent) — d'où des tables classées tirées au hasard, ou du un-contre-un classé ; les règles d'une partie classée sont fixes (un preset, journal compris, ADR-0026), pas celles du maître de jeu ; et un joueur qui quitte pour ne pas perdre (le relais par un bot existe déjà, ADR-0013, la défaite doit compter).

**Variante sans population** : un classement **contre les bots** (et celui du défi du jour, 1) vit sans matchmaking.

## 6. Matchmaking public

**L'idée** : « Jouer maintenant », une file qui assemble une table avec des inconnus, éventuellement par niveau et par langue.

**Ce qui existe déjà** : les salles en ligne (un Durable Object par salle), les sièges tenus par des bots, la reconnexion.

**Le problème est la population, pas le code.** Avec peu de joueurs, une file attend indéfiniment. Les remèdes : compléter la table avec des bots **annoncés comme tels** après quelques secondes ; des créneaux (« la table du vendredi 21 h ») qui concentrent les joueurs ; les parties asynchrones (7). Côté technique : un Durable Object « file » qui crée la salle, et une table publique doit avoir des règles imposées.

**À ne lancer** que quand `/admin/` montre assez de parties en ligne par jour.

## 7. Parties asynchrones et notifications

**L'idée** : une partie où chacun joue quand il veut, notifié quand c'est son tour (jeu par correspondance). C'est la meilleure réponse à une petite population et aux amis qui ne sont pas disponibles ensemble.

**Ce que ça demande** : des salles qui vivent des jours (pas 2 h) et donc un stockage durable, la **défausse rapide coupée** (elle demande d'être là en même temps — c'est déjà un champ du `RuleSet`), un délai par tour, et les notifications Web Push : elles marchent sur Android et, depuis iOS 16.4, sur iPhone **quand le jeu est installé sur l'écran d'accueil**.

**Question pour toi** : une partie asynchrone, c'est une manche ou une partie entière ?

## 8. International

**Ce qui existe déjà** : le jeu est en français et en anglais (`apps/web/src/i18n`), les pages d'accueil aussi.

**Ce que ça demande** : des langues de plus (espagnol, italien, portugais, allemand), les pages d'accueil et le référencement par langue, des noms de cartes et de pouvoirs vérifiés par un natif ; le jeu se joue sous d'autres noms ailleurs (cousin de Golf et de Cabo) — à garder en tête pour le référencement, sans emprunter le nom d'un jeu commercial.

**Lancée le 2026-11-27** : espagnol, italien, portugais, allemand, japonais, chinois (simplifié et traditionnel). Le plan détaillé, ses étapes et ses questions sont dans `docs/plans/languages.md`.

## 9. Marketing et acquisition

Classées de la plus rentable à la plus coûteuse pour un jeu web gratuit :

- **Référencement** : « règles du Tamalou » est une recherche fréquente ; une page de règles claire, illustrée, avec « jouer maintenant », est la porte d'entrée la moins chère.
- **Le partage dans le produit** : le défi du jour (1), le défi entre amis, le lien de salle avec sa carte d'aperçu (déjà là, C17).
- **Les portails de jeux web** (CrazyGames, Poki…) : ils apportent une population toute faite, au prix d'une intégration et parfois de publicités imposées.
- **Vidéos courtes** (TikTok, Reels, Shorts) : une partie filmée, un « coup de Tamalou » ; une communauté Discord pour les fidèles.
- **Lancements ponctuels** : Product Hunt, itch.io, Reddit (r/boardgames, r/WebGames), forums de jeux de cartes.

**Question pour toi** : combien de temps par semaine veux-tu y mettre toi-même ? (c'est ici que le temps du propriétaire compte le plus).

## 10. Applications des stores (bonus)

**Constat** : la PWA fait déjà l'essentiel (installation, hors-ligne, mises à jour proposées, ADR-0020 ; notifications possibles, voir 7). Une application de store n'apporte surtout que de la **visibilité dans les stores**.

- **Android, Google Play** : une TWA (la PWA emballée, Bubblewrap) ; 25 $ une fois, presque aucun code. Le bonus le moins cher.
- **iPhone, App Store** : un emballage Capacitor ; **99 €/an**, une revue Apple qui refuse parfois les applications « simple site web », et un build à maintenir. À garder pour plus tard, s'il y a une population à aller chercher là.

---

## Pour lancer une session

Une session par piste, ouverte avec une phrase de ce genre (à adapter) :

- « Lis `docs/IDEAS.md`, section 1. Propose-moi sur un canvas deux ou trois façons de faire le défi du jour et le défi entre amis, avec l'écran de résultat partagé. Pas de code avant mon choix. »
- « Lis `docs/IDEAS.md`, sections 2 et 3. Dessine le parcours solo : les étapes, les étoiles, les succès, ce qui se débloque. »
- « Lis `docs/IDEAS.md`, sections 4 et 5. Évalue l'identité légère et le classement : ce qu'il faut garder côté serveur, le coût, ce que ça change à la mention légale. Rédige l'ADR à valider. »
- « Lis `docs/IDEAS.md`, section 9. Prépare la page des règles du Tamalou pour le référencement, en français et en anglais. »
- « Lis `docs/IDEAS.md`, section 10. Emballe le jeu pour Google Play en TWA et dis-moi ce que j'ai à faire de mon côté. »
