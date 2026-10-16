# Tamalou

Le jeu de cartes Tamalou, jouable sur le web, d'abord sur téléphone : quatre cartes face cachée, de la mémoire, des pouvoirs, la défausse rapide, et « Tamalou ! » pour finir la manche avec le plus petit total.

Quatre modes sont prévus : solo contre des bots, pass-and-play sur un seul appareil, LAN sans internet et en ligne (une salle temporaire qu'on rejoint par un code ou un lien, sans compte). Le maître de jeu configure toutes les règles avant la partie.

**État** : M3. On joue en solo contre 1 à 5 bots, sur téléphone ou ordinateur : https://costardrouge.github.io/tamalou/ (publié depuis `main`). L'écran du maître de jeu arrive en M4, le pass-and-play en M5. Le plan complet est dans [`docs/SPEC.md`](docs/SPEC.md) §8.

## Ce qui existe

- `packages/shared` : le `RuleSet` (toutes les règles, typées et validées, avec leurs valeurs par défaut), les presets « Classique », « Rapide » et « Débutant », et les types échangés (actions, événements, vues).
- `packages/engine` : le moteur pur. Une partie se rejoue à l'identique depuis sa graine et ses actions, et chaque joueur ne reçoit que sa vue filtrée.
- `packages/room` : l'hôte d'une partie (les bots à leur rythme, la fenêtre de défausse rapide, l'enchaînement des manches, le timer de tour), le même dans le navigateur et, plus tard, sur les serveurs.
- `apps/web` : le jeu, en français, mobile d'abord, clair ou sombre selon le système, avec la charte de Versus.
- `packages/bots` : trois niveaux de bots qui ne voient que leur propre vue. **Facile** joue au hasard (coups légaux), **moyen** a une mémoire imparfaite et une heuristique simple, **difficile** retient tout, estime les cartes inconnues, vise le joueur le plus dangereux et choisit son moment pour annoncer Tamalou.

```bash
pnpm simulate                                  # 1000 parties aléatoires, de 2 à 6 joueurs
pnpm simulate --games 200 --players 4 --preset quick
pnpm bots                                      # taux de victoire des niveaux, deux à deux
pnpm bots --levels hard,medium,easy --games 500
```

## Développer

```bash
corepack enable   # active la version de pnpm fixée dans package.json
pnpm install
pnpm dev          # le jeu sur http://localhost:5173 (et sur l'IP de la machine pour un téléphone du même réseau)
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
