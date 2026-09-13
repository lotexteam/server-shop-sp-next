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

Контейнер слушает 3000 (внутри), наружу — `STOREFRONT_PORT` (по умолчанию
127.0.0.1:3100). Caddy проксирует на алиас `server-shop-sp-next-storefront`
в сети `shop` — та же схема, что у SPA-витрины.

Healthcheck: `GET /api/healthz`.

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
