# The LAN server (docs/SPEC.md §5.4): rooms and the web app on one port, no internet needed once built.
#   docker build -t tamalou .
#   docker run --rm --network host tamalou          # or: docker compose up -d
# Built images of main: ghcr.io/costardrouge/tamalou:latest (deploy.yml).
# Two stages: everything to build the web app, then only the server's production dependencies. The server runs its
# TypeScript sources with Node's type stripping, which refuses files under node_modules: the workspace packages stay
# in packages/, linked by pnpm, never copied into node_modules (docs/memory/architecture.md).

FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build

FROM node:24-alpine
LABEL org.opencontainers.image.source="https://github.com/CostardRouge/tamalou" \
      org.opencontainers.image.description="Tamalou, the card game: LAN server and web app" \
      org.opencontainers.image.licenses="MIT"
WORKDIR /app
RUN corepack enable
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
