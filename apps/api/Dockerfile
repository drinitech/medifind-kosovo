# syntax=docker/dockerfile:1
# Build context is the repo root (pnpm workspace): docker compose up -d --build api
FROM node:24-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/* \
 && npm install -g pnpm@11.21.0
WORKDIR /app
COPY . .
RUN pnpm install --filter api --frozen-lockfile --prod=false \
 && pnpm --filter api build
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/main.js"]
