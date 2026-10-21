# The LAN server (docs/SPEC.md §5.4): rooms and the web app on one port, no internet needed once built.
#   docker build -t tamalou .
#   docker run --rm --network host tamalou          # or: docker compose up -d
# Built images of main: ghcr.io/costardrouge/tamalou:latest (deploy.yml).
# Two stages: everything to build the web app, then only the server's production dependencies. The server runs its
# TypeScript sources with Node's type stripping, which refuses files under node_modules: the workspace packages stay
# in packages/, linked by pnpm, never copied into node_modules (docs/memory/architecture.md).
# Node is pinned exactly (COMMON-PROJECT-SPEC C14): a moving `26-alpine` ships whatever runtime the registry holds that
# day, which nobody tested here; Dependabot raises the tag (.github/dependabot.yml), one pull request the CI gate checks.
# Node 25+ no longer bundles corepack: it comes from npm at an exact version, then pins pnpm from packageManager.

FROM node:26.12.0-alpine AS build
WORKDIR /app
RUN npm install -g corepack@0.36.0 && corepack enable
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build

FROM node:26.12.0-alpine
LABEL org.opencontainers.image.source="https://github.com/CostardRouge/tamalou" \
      org.opencontainers.image.description="Tamalou, the card game: LAN server and web app" \
      org.opencontainers.image.licenses="MIT"
WORKDIR /app
RUN npm install -g corepack@0.36.0 && corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/server ./apps/server
RUN pnpm install --frozen-lockfile --prod --filter "@tamalou/server..." && rm -rf /root/.cache /root/.local/share/pnpm
COPY --from=build /app/apps/web/dist ./apps/web/dist
ENV NODE_ENV=production PORT=8080 HOST=0.0.0.0
EXPOSE 8080
USER node
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" || exit 1
CMD ["node", "apps/server/src/main.ts"]
