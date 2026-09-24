# ── Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# NEXT_PUBLIC_* вшиваются в клиентский бандл на этапе build.
ARG NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8080/api/v1
ARG NEXT_PUBLIC_MEDIA_BASE_URL=
ARG API_BASE_URL=http://127.0.0.1:8080/api/v1
ARG APP_URL=http://localhost:3000
# Single-domain деплой (один хост с admin-ui): префикс статики витрины,
# чтобы /_next/* не конфликтовал с админкой (маршрут в Caddyfile).
# Пусто = обычный /_next (multi-domain/standalone).
ARG NEXT_ASSET_PREFIX=
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_MEDIA_BASE_URL=$NEXT_PUBLIC_MEDIA_BASE_URL
ENV API_BASE_URL=$API_BASE_URL
ENV APP_URL=$APP_URL
ENV NEXT_ASSET_PREFIX=$NEXT_ASSET_PREFIX
ENV NEXT_TELEMETRY_DISABLED=1

# Воркер MapLibre — пара соседних ES-модулей, Next их по URL бандла не отдаёт
# (см. scripts/copy-maplibre-worker.mjs). Не postinstall: npm ci выше видит
# только package.json.
RUN node scripts/copy-maplibre-worker.mjs
RUN npm run build

# ── Runtime (output: standalone) ─────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
