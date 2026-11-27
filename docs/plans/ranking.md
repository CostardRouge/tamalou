# Plan — classement OpenSkill et « Jouer maintenant »

L'évaluation des pistes 4 (identité légère), 5 (classement) et 6 (matchmaking public) de `docs/IDEAS.md`, lancée par le propriétaire le 2026-11-27 (« go step number 6 : openskill »). **Ses choix sont tranchés le jour même** (§ 9) et consignés dans l'**ADR-0029**, qui fait foi ; `docs/SPEC.md` § 5.3 et la déclaration C18 de `CLAUDE.md` sont amendés. Ce document se lit avant de lancer chaque étape (§ 10). Là où l'évaluation proposait plusieurs voies, le choix est celui du § 9.

**En une phrase** : le code est à la portée du projet (les salles, les bots, le moteur rejouable existent) ; ce qui coûte, c'est une décision — garder des joueurs sur un serveur, pour la première fois — et une population — une file vide fait fuir. D'où la recommandation : **un classement contre les bots d'abord**, qui marche avec zéro joueur en ligne, puis la file publique quand `/admin/` montre du monde.

---

## 1. L'identité : reconnaître un joueur sans compte

Un classement suppose de retrouver un joueur d'une partie à l'autre. Aujourd'hui, rien ne le permet, volontairement : pas de compte (ADR-0025, le profil reste sur le téléphone), et le numéro d'appareil des statistiques (ADR-0024, depuis aujourd'hui) **ne sert qu'aux statistiques** — il ne doit pas devenir une identité, sinon les statistiques deviennent nominatives.

**Proposition** : une identité de joueur classé, **à part**, créée seulement par qui ouvre le mode classé.

- **Un pseudo + un secret tiré sur l'appareil** (128 bits aléatoires). Le serveur n'en garde que l'empreinte (un hachage) ; le téléphone le garde dans `localStorage`. Pas d'e-mail, pas de mot de passe.
- **Un code de récupération** : le même secret écrit lisiblement (`TAMA-7KQ2-…`), montré une fois à la création, à noter ou à photographier, et inclus dans le fichier « Sauvegarder » de « Mes parties ». C'est ce qui fait passer le joueur d'un téléphone à l'autre. Perdu, il est perdu : personne ne peut le renvoyer (pas d'e-mail).
- **Une passkey plus tard** : une clé WebAuthn liée au joueur, que l'iPhone ou Android synchronise tout seuls entre les appareils du même compte Apple ou Google. Elle remplace le code pour la plupart des gens. Une étape à part, quand le reste tourne.
- **Rejetés** : Sésame (une invitation par personne, fait pour l'admin, pas pour le public) ; un e-mail (une donnée de plus à protéger, des e-mails à envoyer) ; réutiliser `deviceId` (mélangerait statistiques anonymes et classement).

## 2. Le stockage côté Worker

| | Durable Object SQLite (comme `UsageObject`) | D1 |
|---|---|---|
| Mise en place | rien à créer : une classe de plus dans `wrangler.jsonc` | une base à créer à la main, son id dans la config |
| Sauvegarde intégrée | retour à n'importe quel instant des 30 derniers jours (PITR) | idem (« Time Travel », 30 jours) |
| Débit | un seul objet = un seul fil ; des milliers de requêtes/s, largement assez | plus large, inutile ici |
| Gratuit Cloudflare | 5 Go, 100 000 lignes écrites/jour, 5 M lues/jour | proche |

**Proposition : un Durable Object SQLite, `LadderObject`**, comme `UsageObject` (ADR-0024 avait déjà écarté D1 pour la même raison). Il tient les joueurs (id, empreinte du secret, pseudo, avatar, μ, σ, nombre de parties, dernière partie) et les parties classées (date, joueurs, ordre final). Ordre de grandeur : 10 000 joueurs ≈ 2 Mo.

**Sauvegardes — c'est là que C18 change.** Aujourd'hui « rien à sauvegarder » : perdre les statistiques ne perd que de l'historique. Perdre un classement fâche ses joueurs. La reprise à 30 jours de Cloudflare couvre une erreur de déploiement ; pour le reste, un export JSON hebdomadaire, téléchargeable depuis `/admin/`, suffit à cette échelle (pas de stockage R2 en plus).

**Conservation** : un joueur sans partie classée depuis **13 mois** est effacé (même plafond que les statistiques) ; une partie classée est gardée 13 mois. Un joueur peut tout effacer lui-même (§ 3).

## 3. RGPD, mention légale, modération

- **Un pseudo public lié à un niveau est une donnée personnelle** (pseudonyme, mais rattachable). Base légale : l'exécution du service que le joueur demande en ouvrant le mode classé — pas besoin d'un bandeau de consentement, mais d'une information claire au moment de la création.
- **Ses droits, dans le jeu** : voir et télécharger ses données, changer de pseudo, **« Supprimer mon profil classé »** (effacement immédiat ; ses anciennes parties restent comptées pour les autres, sous « Joueur supprimé »).
- **La mention légale** (`/mentions-legales/`, `/en/legal/`) gagne une section : ce qui est gardé, combien de temps, à quoi ça sert, comment l'effacer. Les données ne quittent pas Cloudflare ; aucun lien avec les statistiques ni avec Umami.
- **La modération des pseudos**, le vrai coût humain. Le règlement européen sur les services numériques (DSA) demande à tout hébergeur de contenu fourni par ses utilisateurs un moyen de **signaler** un contenu — un pseudo en est un. Trois niveaux, du plus libre au plus tranquille :
  1. **Pseudo libre** + une liste de mots refusés + un bouton « Signaler » + dans `/admin/` « Renommer en Joueur 1234 ». Le propriétaire modère lui-même.
  2. **Pseudo libre à la table, pseudo généré dans le classement public** (« Dame Rusée », « Valet Pressé » + 3 chiffres). Ce que voient les inconnus ne se modère pas.
  3. **Pseudo généré partout**, choisi parmi des propositions. Zéro modération, moins de personnalité.
  Recommandation : le 2.

## 4. OpenSkill

- **Le modèle** : Weng-Lin (2011), la famille bayésienne de TrueSkill, sans ses brevets. Chaque joueur a un niveau estimé **μ** et une incertitude **σ** (départ 25 et 8,33). Après chaque partie, μ bouge selon les places obtenues face aux niveaux des autres, et σ baisse : un nouveau monte ou descend vite, un ancien bouge peu.
- **La bibliothèque** : `openskill` sur npm (philihp/openskill.js), **licence MIT**, version 5.0.1, JavaScript pur, tourne dans un Worker comme dans Vitest. Dépendances : ramda et deux fonctions de stdlib. Elle vivrait dans un paquet pur, `packages/ranking`, avec ses tests (la logique métier reste dans `packages/`).
- **Noter une partie à 2–6 joueurs** : le modèle Plackett-Luce (celui par défaut) prend un **ordre final** : chaque joueur est une équipe d'un, `rate([[a],[b],[c],[d]], { rank: [1, 2, 2, 4] })`, ex æquo permis. L'ordre vient de l'événement `gameEnded` : à la limite de points (« dernier en lice »), le premier éliminé est dernier, puis les survivants par total ; en nombre de manches, le total le plus bas gagne. L'écart de points ne compte pas, seule la place compte : on ne gagne rien à écraser quelqu'un.
- **Les bots comme repères** : chaque niveau de bot reçoit un μ fixe, mesuré une fois par `pnpm bots` (le difficile bat le moyen 73 % du temps), et n'est jamais mis à jour. Un humain qui bat des bots faciles gagne peu, des bots difficiles beaucoup : **le classement contre les bots est le même classement que contre les humains**, pas un second.
- **Afficher un niveau, pas des chiffres** : le score « prudent » μ − 3σ ne monte qu'avec des parties. On ne le montre pas tel quel : un niveau lisible (des paliers nommés d'après les cartes, un nombre façon Elo, ou un rang en pourcentage — à choisir sur le canvas), et « en calibrage » pendant les 10 premières parties.

## 5. Une partie classée : des règles imposées

Le maître de jeu ne règle rien : un classement compare des parties jouées aux mêmes règles.

- **Le preset Classique**, verrouillé, avec ses valeurs par défaut (journal : le dernier tour, ADR-0026 ; pas de défausse racontée ; pas de confirmation des coups).
- **La défausse rapide active** : c'est le sel du jeu. Le serveur prend la première demande arrivée (déjà le cas, ADR-0008) ; une bonne connexion a quelques millisecondes d'avance, acceptable.
- **Une minuterie de tour** imposée (proposition : 30 s), sans quoi un joueur bloque la table ; à l'expiration, le remplaçant joue (existe déjà).
- **Une partie courte** : 100 points en « dernier en lice » peut durer longtemps. Proposition : **5 manches**, le total le plus bas gagne (≈ 10–15 min). À trancher (question 4).
- **Jouée sur le serveur, toujours** — même seul contre des bots. En solo, le navigateur fait tourner le moteur avec toutes les cartes : il pourrait les lire, ou inventer un résultat. Une partie classée contre les bots est donc une salle en ligne sans autre humain : le serveur ne lui envoie que sa vue (comme aujourd'hui), et c'est lui qui connaît le résultat. Pas de partie classée hors ligne, ni en LAN.

## 6. Les pièges

- **La collusion** (deux amis à la même table publique qui se parlent) : on ne choisit pas sa table classée, elle est tirée par la file ; une salle entre amis reste **amicale** (non classée). Avec peu de monde, deux amis qui lancent la file en même temps tomberont ensemble : on évite d'apparier deux joueurs qui ont joué ensemble dans leurs 5 dernières parties classées. Ce n'est pas étanche ; à cette échelle, c'est assez.
- **L'abandon pour ne pas perdre** : quitter = **dernière place**, comptée à la fin de la partie ; le remplaçant joue la place jusqu'au bout (ADR-0013), les autres jouent normalement. Revenir avant la fin reprend la place. Des abandons répétés → une attente avant la file suivante.
- **Les bots qui complètent la table** : toujours **annoncés** (« Bot · moyen » sur le siège et dans le salon), jamais déguisés en humains. Ils comptent comme repères fixes (§ 4).
- **Le farm** (enchaîner des parties faciles) : Plackett-Luce le neutralise, battre plus faible rapporte peu.
- **Les créneaux** : « la table du vendredi 21 h » concentre les joueurs au même moment. `/admin/` (« Quand on joue », par heure et jour) dira lequel choisir.

## 7. Ce que montre `/admin/` sur la population

Je ne lis pas `/admin/` (il est derrière ta connexion Sésame). Ce qu'il montre déjà : parties lancées et finies par jour, par mode (solo, à plusieurs, en ligne), tailles de table, heures de jeu. Le comptage des appareils qui reviennent (ADR-0024) n'a commencé **qu'aujourd'hui** : dans deux ou trois semaines, il dira combien de gens jouent plus d'un jour.

Ordre de grandeur pour qu'une file se remplisse **sans** bots : pour réunir 4 inconnus en moins d'une minute, il faut environ 4 recherches par minute à cette heure-là, soit ~240 dans l'heure ; à 2 joueurs, ~2 par minute. Bien au-dessus d'un petit jeu entre amis. Conclusion : au début, la file publique serait surtout des bots — d'où l'ordre du § 10.

## 8. Le coût

- **Argent** : à cette échelle, le gratuit de Cloudflare suffit (5 Go de SQLite, 100 000 lignes écrites par jour ; une partie classée en écrit une dizaine). Au-delà, l'offre Workers payante, 5 $/mois. Une partie classée contre les bots occupe un Durable Object comme une salle en ligne aujourd'hui.
- **Ton temps** : les décisions ci-dessous ; un test par étape sur ton téléphone ; **la modération** si le pseudo est libre dans le classement ; répondre aux « j'ai perdu mon code ».
- **Le travail d'agent** : 5 à 6 étapes (§ 10), chacune une session et une pull request.

## 9. Les questions, et les choix du propriétaire (2026-11-27)

1. **Garder des joueurs sur le serveur** : d'accord pour un `LadderObject` qui garde pseudo, avatar, niveau et parties classées, effacés après 13 mois sans partie classée, avec un export hebdomadaire depuis `/admin/` ? (C18 passe de « rien à sauvegarder » à « le classement, sauvegardé ».)
2. **Le pseudo public** : libre et modéré par toi (1), libre à la table mais généré dans le classement (2, recommandé), ou généré partout (3) ?
3. **La première étape livrable** : le classement contre les bots (recommandé), un défi du jour classé (piste 1), ou directement la file publique ?
4. **Le format classé** : Classique verrouillé, défausse rapide active, journal « dernier tour », minuterie 30 s, **5 manches** — d'accord, ou une autre durée (limite de 50 points, 3 manches…) ?
5. **Les écrans** : tes choix sur le canvas (« Jouer maintenant », la file, le niveau affiché, le classement).

**Ses réponses**, sur le canvas https://claude.ai/artifact/8SdbsD5bXGabzTprahRNHS (privé, ses choix dans sa base `picks/owner`) :

| | Choix |
|---|---|
| 1. Données | **oui**, avec l'export hebdomadaire depuis `/admin/` |
| 2. Pseudo | **libre à la table, généré pour les inconnus** (le 2) : tout ce qu'un inconnu voit est généré, donc rien à modérer ni à signaler |
| 3. Première étape | **le classement contre les bots** |
| 4. Durée | **5 manches**, total le plus bas |
| Lancer | **C** : une tuile « Classé » ouvre son propre écran (niveau, « Contre les bots », plus tard « Contre des joueurs », un aperçu du classement) |
| Attente | **A** : la table qui se remplit siège par siège, un compte à rebours, puis des bots annoncés |
| Niveau | **A** : treize paliers nommés d'après les cartes, du Deux à l'As, une barre jusqu'au suivant |
| Classement | **B** : autour de moi, et les joueurs croisés récemment |

## 10. Le découpage (confirmé par l'ADR-0029)

Chaque étape est sa propre session et sa propre pull request, jouable ou testable.

- **R0 — L'identité** (livrée le 2026-11-27) : créer son profil classé (pseudo généré, code de récupération), le retrouver sur un autre téléphone, télécharger ses données, le supprimer ; `LadderObject` ; l'export du classement dans `/admin/` ; la mention légale. *Test* : créer, restaurer sur un second téléphone, supprimer.
- **R1 — Classé contre les bots** : `packages/ranking` (OpenSkill, l'ordre final, les repères des bots mesurés par `pnpm bots`), le preset classé, une salle classée sur le Worker avec des bots, l'écran « Classé » (choix C), le niveau en cartes après la partie (choix A), « en calibrage ». *Test* : dix parties, voir son niveau bouger.
- **R2 — Le classement** : autour de moi et les joueurs croisés (choix B), sous leurs pseudos générés. *Test* : se trouver, retrouver un adversaire.
- **R3 — La file « Contre des joueurs »** : un Durable Object « file » qui assemble une table au hasard, la table qui se remplit (choix A), des bots annoncés après le compte à rebours, l'abandon compté. À lancer quand `/admin/` montre assez de parties en ligne. *Test* : deux téléphones qui se trouvent ; un seul, complété par des bots.
- **Plus tard** : la passkey ; les créneaux (« la table du vendredi 21 h »), si la file reste vide ; une vue en direct des salles dans `/admin/` (souhaitée le 2026-11-27, vient avec la file) ; les parties asynchrones (piste 7), non classées d'abord.
