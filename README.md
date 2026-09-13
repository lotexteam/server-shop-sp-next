# server-shop-sp-next

Next.js 16 (App Router, SSR) версия витрины **server-shop-sp-ui** — первый скин
каталога серверного оборудования. Полная миграция с сохранением дизайна 1:1.

| | |
|---|---|
| Каркас | Next.js 16 App Router, `output: 'standalone'`, Turbopack (dev) |
| UI | React 19 (client components), Tailwind CSS 3.4, Radix UI, framer-motion |
| SEO | Серверный `generateMetadata` через Storefront API `/seo/document`; JSON-LD в SSR-HTML |
| API | Laravel `/api/v1` (контракт: `server-shop/docs/STOREFRONT-API.md`) |
| Деплой | Docker: node:20-alpine standalone → сеть `shop` за Caddy |

## История миграции

- План и журнал: [`docs/MIGRATION-PLAN.md`](docs/MIGRATION-PLAN.md),
  [`docs/MIGRATION-LOG.md`](docs/MIGRATION-LOG.md).
- Исходная SPA-версия (Vite + react-router): репозиторий `server-shop-sp-ui`,
  остаётся нетронутой до конца параллельной эксплуатации.

## Запуск (dev)

```bash
npm install
cp .env.example .env   # указать NEXT_PUBLIC_API_BASE_URL бэкенда
npm run dev            # http://localhost:3000
```

Проверки: `npm run typecheck` (tsc --noEmit).

## Переменные окружения

См. [`.env.example`](.env.example):

- `NEXT_PUBLIC_API_BASE_URL` — база Storefront API (клиент + фолбэк сервера);
- `API_BASE_URL` — серверная копия (generateMetadata/SSR fetch), можно не
  задавать, если совпадает с публичной;
- `APP_URL` — канонический origin витрины (canonical/OG);
- `NEXT_PUBLIC_MEDIA_BASE_URL` — origin хранилища картинок (preconnect hint).

Важно: `NEXT_PUBLIC_*` вшиваются в бандл **на этапе build** — при смене значения
требуется пересборка образа (в отличие от SPA, где env тоже вшивался в бандл).

## Продуктовый запуск

```bash
cp .env.example .env.prod
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Контейнер слушает **:80** (`CONTAINER_PORT`) и живёт в сети `shop` под алиасом
`STOREFRONT_ALIAS` — Caddy проксирует на него, как на nginx старой витрины,
**Caddyfile менять не нужно**. Healthcheck: `GET /api/healthz`.

Для прямого доступа без Caddy: `docker compose -f docker-compose.prod.yml -f
docker-compose.publish.yml --env-file .env.prod up -d` (порт `UI_PUBLISH`).

## Миграция в один клик (замена старой Vite-витрины)

Миграция — **флаг `--migrate` в `update.sh`** (единая точка деплоя):

```bash
./scripts/update.sh --migrate              # найдёт ../server-shop-sp-ui сам
./scripts/update.sh --migrate --dry-run    # показать план без действий
```

**Автоопределение:** если запустить просто `./scripts/update.sh` при
отсутствующем `.env.prod`, но рядом найдена старая витрина — скрипт сам
перейдёт в режим миграции. **После миграции** все последующие вызовы
`./scripts/update.sh` (включая Deploy workflow по тегам) автоматически
обновляют уже Next-витрину — ничего переключать не нужно.

Скрипт сам: конвертирует `.env.prod` старой витрины (VITE_* → NEXT_*) →
деплоит Next-контейнер под canary-алиасом (сайт продолжает работать) →
останавливает старый контейнер → пересоздаёт Next с прод-алиасом (Caddy
upstream переключается) → внешний smoke → **автовой старой витрины при
провале**. Опции: `--old-ui <path>`, `--keep-images`.
(`scripts/migrate-to-next.sh` — compat-обёртка, пробрасывает в `update.sh --migrate`.)

Очистка старой витрины (контейнеры/образы/кеш) отдельно:

```bash
./scripts/cleanup-old-ui.sh --images          # контейнеры + образ + dangling
./scripts/cleanup-old-ui.sh --images --all-tags
./scripts/cleanup-old-ui.sh --dry-run
```

## CI/CD (GitHub)

| Workflow | Что делает |
|---|---|
| `CI` (push/PR) | `npm run typecheck` + `next build` |
| `Images` (push main/tag v*) | GHCR `server-shop-sp-next` с build-args из repository Variables: `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_MEDIA_BASE_URL`, `API_BASE_URL`, `APP_URL` |
| `Deploy` (tag v*/manual) | SSH → `scripts/update.sh` (сборка на сервере или pull из GHCR по `DEPLOY_STRATEGY`; smoke + автооткат) |

Secrets для Deploy: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`,
`DEPLOY_PATH` (каталог этого репо на сервере). VM-lock (`/tmp/server-shop-deploy.lock`)
защищает от гонки с соседними витринами на той же VPS.

⚠️ `NEXT_PUBLIC_*` вшиваются в бандл **на этапе build** — смена значения =
пересборка образа (в отличие от `API_BASE_URL`/`APP_URL`, которые читаются
из env контейнера в рантайме).

## Структура

```
app/        маршруты App Router (тонкие серверные обёртки + generateMetadata)
src/views/  компоненты страниц (перенесены из src/pages SPA 1:1)
src/        components/ui/hooks/lib/store/data — без изменений из SPA
public/     статика + self-hosted шрифты Inter Variable
```

## Маршруты

`/`, `/catalog`, `/catalog/[slug]`, `/product/[slug]`, `/configurator`,
`/build/[token]`, `/checkout`, `/blog`, `/blog/[slug]`, `/contacts`,
`/account`, `/account/[tab]`, `/account/orders/[orderId]`, `/unsubscribe`,
`/privacy/withdraw` + 301-редиректы: `/cart→/checkout`,
`/about|/faq|/delivery|/warranty|/tradein|/services|/monitoring → /blog/*`.
