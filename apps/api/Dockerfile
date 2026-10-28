# syntax=docker/dockerfile:1
# Build context is the repo root (pnpm workspace): docker compose up -d --build api
FROM node:24-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/* \
 && npm install -g pnpm@11.21.0
WORKDIR /app
COPY . .
RUN pnpm install --filter api --frozen-lockfile --prod=false \
 && pnpm --filter api build
WORKDIR /app/apps/api

# Dev mode (docker-compose.dev.yml bind-mounts apps/api/src). nodemon polls (-L) because file
# events from Windows bind mounts don't reach the container, and `nest start --watch` ignores
# TypeScript's polling settings; each change recompiles and restarts the app.
FROM base AS dev
RUN npm install -g nodemon@3
ENV PATH=/app/apps/api/node_modules/.bin:$PATH
CMD ["nodemon", "-L", "--watch", "src", "--ext", "ts,json", "--exec", "nest start"]

FROM base
EXPOSE 4000
CMD ["node", "dist/main.js"]
