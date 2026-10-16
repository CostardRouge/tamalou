# Tamalou

Le jeu de cartes Tamalou, jouable sur le web, d'abord sur téléphone : quatre cartes face cachée, de la mémoire, des pouvoirs, la défausse rapide, et « Tamalou ! » pour finir la manche avec le plus petit total.

Quatre modes sont prévus : solo contre des bots, pass-and-play sur un seul appareil, LAN sans internet et en ligne (une salle temporaire qu'on rejoint par un code ou un lien, sans compte). Le maître de jeu configure toutes les règles avant la partie.

**État** : M8, toutes les milestones du plan sont faites. On joue en solo contre 1 à 5 bots, à plusieurs sur un seul téléphone, en ligne (une salle, un code, un lien ou un QR code, chacun sur son téléphone) et sur le réseau local sans internet. Toutes les règles se règlent avant la partie, se consultent pendant, et se partagent par lien ou en fichier JSON. Le jeu s'installe comme une appli, marche hors ligne en solo, parle français ou anglais, avec sons et vibrations. Le plan complet est dans [`docs/SPEC.md`](docs/SPEC.md) §8.

- https://costardrouge.github.io/tamalou/ (publié depuis `main`) : solo et pass-and-play.
- En ligne : le Worker Cloudflare de `apps/worker`, déployé dès que le dépôt a ses identifiants Cloudflare.

## Ce qui existe

- `packages/shared` : le `RuleSet` (toutes les règles, typées et validées, avec leurs valeurs par défaut), les presets « Classique », « Rapide » et « Débutant », et les types échangés (actions, événements, vues).
- `packages/engine` : le moteur pur. Une partie se rejoue à l'identique depuis sa graine et ses actions, et chaque joueur ne reçoit que sa vue filtrée.
- `packages/room` : l'hôte d'une partie (les bots à leur rythme, la fenêtre de défausse rapide, l'enchaînement des manches, le timer de tour) et la salle autour (maître de jeu, tokens de reconnexion, bot qui remplace un absent, spectateurs, expiration), les mêmes dans le navigateur et sur les serveurs.
- `apps/server` : le serveur du réseau local (Node + WebSocket), qui sert aussi le jeu ; `apps/worker` : le même protocole en ligne, sur Cloudflare (un Durable Object par salle).
- `apps/web` : le jeu, en français, mobile d'abord, clair ou sombre selon le système, avec la charte de Versus.
- `packages/bots` : trois niveaux de bots qui ne voient que leur propre vue. **Facile** joue au hasard (coups légaux), **moyen** a une mémoire imparfaite et une heuristique simple, **difficile** retient tout, estime les cartes inconnues, vise le joueur le plus dangereux et choisit son moment pour annoncer Tamalou.

```bash
pnpm simulate                                  # 1000 parties aléatoires, de 2 à 6 joueurs
pnpm simulate --games 200 --players 4 --preset quick
pnpm bots                                      # taux de victoire des niveaux, deux à deux
pnpm bots --levels hard,medium,easy --games 500
```

## Jouer sur le réseau local

```bash
pnpm serve:lan    # construit le jeu et lance le serveur : il affiche l'adresse et un QR code à scanner
```

Sur un serveur maison (Portainer : Stacks → Add stack → Repository, fichier `docker-compose.yml`) :

```bash
docker compose up -d    # puis http://<adresse du serveur>:8080/ ; les logs affichent l'adresse et le QR code
```

L'image de `main` est publiée sur `ghcr.io/costardrouge/tamalou:latest`.

## Développer

```bash
corepack enable   # active la version de pnpm fixée dans package.json
pnpm install
pnpm dev          # le jeu sur http://localhost:5173 (et sur l'IP de la machine pour un téléphone du même réseau)
node apps/server/src/main.ts   # à côté de pnpm dev : les salles en ligne (pnpm dev relaie /api vers :8080)
pnpm worker:dev   # le jeu et les salles sur workerd, comme en ligne (http://localhost:8787)
pnpm check        # lint + typecheck + tests + build
pnpm coverage     # tests avec couverture (seuil 90 %)
```

Node 24 (`.nvmrc`), 22.18 au minimum.

## Documentation

- [`docs/SPEC.md`](docs/SPEC.md) : la spécification, tenue à jour.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) : les décisions structurantes (ADR).
- [`CLAUDE.md`](CLAUDE.md) et [`MEMORY.md`](MEMORY.md) : les conventions et la mémoire du projet, pour les agents.

## Licence

MIT, voir [`LICENSE`](LICENSE).
