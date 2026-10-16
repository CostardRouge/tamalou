# Tamalou

Le jeu de cartes Tamalou, jouable sur le web, d'abord sur téléphone : quatre cartes face cachée, de la mémoire, des pouvoirs, la défausse rapide, et « Tamalou ! » pour finir la manche avec le plus petit total.

Quatre modes sont prévus : solo contre des bots, pass-and-play sur un seul appareil, LAN sans internet et en ligne (une salle temporaire qu'on rejoint par un code ou un lien, sans compte). Le maître de jeu configure toutes les règles avant la partie.

**État** : M1. Le moteur de jeu est écrit et testé, et toutes les règles du brief sont configurables. Il n'y a pas encore d'interface : les bots arrivent en M2, l'écran de jeu en M3. Le plan complet est dans [`docs/SPEC.md`](docs/SPEC.md) §8.

## Ce qui existe

- `packages/shared` : le `RuleSet` (toutes les règles, typées et validées, avec leurs valeurs par défaut), les presets « Classique », « Rapide » et « Débutant », et les types échangés (actions, événements, vues).
- `packages/engine` : le moteur pur. Une partie se rejoue à l'identique depuis sa graine et ses actions, et chaque joueur ne reçoit que sa vue filtrée.

```bash
pnpm simulate                                  # 1000 parties aléatoires, de 2 à 6 joueurs
pnpm simulate --games 200 --players 4 --preset quick
```

## Développer

```bash
corepack enable   # active la version de pnpm fixée dans package.json
pnpm install
pnpm check        # lint + typecheck + tests
pnpm coverage     # tests avec couverture (seuil 90 %)
```

Node 24 (`.nvmrc`), 22.18 au minimum.

## Documentation

- [`docs/SPEC.md`](docs/SPEC.md) : la spécification, tenue à jour.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) : les décisions structurantes (ADR).
- [`CLAUDE.md`](CLAUDE.md) et [`MEMORY.md`](MEMORY.md) : les conventions et la mémoire du projet, pour les agents.

## Licence

MIT, voir [`LICENSE`](LICENSE).
