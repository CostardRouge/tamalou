# Tamalou

Le jeu de cartes Tamalou, jouable sur le web, d'abord sur téléphone : quatre cartes face cachée, de la mémoire, des pouvoirs, la défausse rapide, et « Tamalou ! » pour finir la manche avec le plus petit total.

Quatre modes sont prévus : solo contre des bots, pass-and-play sur un seul appareil, LAN sans internet et en ligne (une salle temporaire qu'on rejoint par un code ou un lien, sans compte). Le maître de jeu configure toutes les règles avant la partie.

**État** : M0, les fondations du dépôt. Le moteur arrive en M1. Le plan complet est dans [`docs/SPEC.md`](docs/SPEC.md) §8.

## Développer

```bash
corepack enable   # active la version de pnpm fixée dans package.json
pnpm install
pnpm check        # lint + typecheck + tests : ce que la CI exécute
```

Node 24 (`.nvmrc`), 22.18 au minimum.

## Documentation

- [`docs/SPEC.md`](docs/SPEC.md) : la spécification, tenue à jour.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) : les décisions structurantes (ADR).
- [`CLAUDE.md`](CLAUDE.md) et [`MEMORY.md`](MEMORY.md) : les conventions et la mémoire du projet, pour les agents.

## Licence

MIT, voir [`LICENSE`](LICENSE).
