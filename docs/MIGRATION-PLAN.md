# Миграция витрины server-shop-sp-ui → Next.js (SSR)

> **Статус:** план, утверждён к исполнению 2026-09-21.
> **Pilot:** витрина `server-shop-sp-ui` (первый скин). После успешного перехода —
> `server-shop-sale-ui` по этому же рецепту (раздел 15).
> **Главные требования:** дизайн 1:1 без изменений; новый проект живёт в отдельном
> каталоге/репозитории; старый React удаляется только после тестов и стабильной
> эксплуатации нового.

---

## 1. Резюме

| Параметр | Сейчас | Станет |
|---|---|---|
| Каркас | Vite 6 + React 19 SPA (createBrowserRouter) | Next.js 16 App Router, `output: 'standalone'` |
| Рендеринг | CSR, пустой `#root` + loading-скелет | Полноценный SSR-HTML для всех посетителей и ботов |
| Роутинг | react-router-dom 7 (35–41 файл) | Файловая маршрутизация App Router + `next/link` / `next/navigation` |
| SEO | bot-HTML бэкенда + клиентский `DocumentHead` | SSR-HTML + серверный `generateMetadata` (тот же `/seo/document`) |
| Деплой | Docker: статику отдаёт nginx | Docker: Node standalone-контейнер, Caddy без изменений |
| Дизайн | Tailwind 3.4, Radix UI, framer-motion, @fontsource | **Тот же стек, те же файлы, без апгрейдов** |
| Состояние | React Context + localStorage | Без изменений (переносится как есть) |

**Почему App Router SSR (выбор для SEO):** SSR отдаёт краулеру готовый HTML на
каждом URL без опоры на bot-HTML бэкенда и клиентский JS; LCP/FCP улучшаются
(исчезает пустой `#root` + скелет); клиенты мессенджеров/соцсетей получают OG-теги
безусловно. Все существующие компоненты переносятся как `'use client'` почти без
правок — т.к. Next рендерит client-компоненты на сервере в HTML, дизайн остаётся
пиксельно тем же, а риск гидрации — контролируемым (раздел 10).

---

## 2. Принципы миграции

1. **Дизайн — заморожен.** Никаких «заодно улучшим». Tailwind остаётся на v3.4
   (не v4!), токены, шрифты, тени, анимации переносятся байт-в-байт.
2. **Новый проект — новый каталог.** `server-shop-sp-next/` рядом с
   `server-shop-sp-ui/`. Старый репозиторий до конца миграции не изменяется
   (кроме critical-fix'ов, если таковые возникнут).
3. **Параллельная жизнь.** Оба варианта работают одновременно на разных портах/
   контейнерах до момента переключения; переключение — обратимое.
4. **Рецепт документируется по ходу.** Каждое отклонение от плана фиксируется в
   `docs/MIGRATION-LOG.md` нового репо — это учебник для sale-ui.
5. **Удаление старого — отдельный финальный шаг** после критериев приёмки
   (раздел 13).

---

## 3. Исходное состояние (аудит pilot'а)

- **Объём:** ~19 500 LOC, 106 файлов в `src/` (TS/TSX/CSS).
- **Стек:** React 19, react-router-dom 7.1, Tailwind 3.4 + tailwindcss-animate,
  Radix UI (accordion, checkbox, dialog, dropdown-menu, label, radio-group,
  select, slot, switch, tabs, tooltip), framer-motion 11, lucide-react,
  react-markdown + rehype-raw + remark-gfm, @fontsource (Inter variable,
  Roboto Condensed).
- **Состояние:** `store/shop.tsx` (корзина/избранное/сравнение/сборки →
  localStorage `server-price-shop-v2`), `store/auth.tsx` (токен Sanctum →
  localStorage `server-price-api-token`, cart-token). Без Redux/Zustand.
- **API-клиент:** `lib/api.ts` (~3000 строк, fetch, `API_BASE` из env), энпоинты
  каталога/чекаута/аккаунта/SEO-документа.
- **Роуты:** 25 записей в `router.tsx` (14 реальных страниц + 9 `Navigate`-редиректов
  + catch-all 404).
- **SEO-слой:** клиентский `DocumentHead.tsx` тянет `/seo/document` и применяет
  title/description/robots/OG/canonical/JSON-LD; `redirect_to` из SeoDocument →
  клиентская навигация (легаси-301 для людей, P0.2/P0.4). Бот-HTML рендерит
  Laravel (`SeoDocumentBuilder`).
- **Сборочные фишки Vite** (нужно воспроизвести эквиваленты, см. раздел 7):
  inline CSS, preload woff2 Roboto Condensed, preconnect к origin картинок
  (`VITE_MEDIA_BASE_URL`), статические OG-теги в shell (`VITE_APP_URL`),
  vendor-chunk'и + terser drop_console.
- **Деплой:** Dockerfile (node:20-alpine build → nginx:1.27-alpine static),
  compose с healthcheck `/healthz`, mem_limit 256m, сеть `shop` + алиас для Caddy.
- **Специфика скина:** `TopBar.tsx`, `WhyStorySection.tsx` (нет у sale-ui);
  нет breadcrumbs, CategoryNav, QuickOrderButton, ProposalPage, data-файлов
  (faq/info/requisites/reviews), `lib/homeText.ts`, `lib/nav.ts`.

---

## 4. Целевая архитектура

### 4.1. Решения

| Решение | Выбор | Обоснование |
|---|---|---|
| Версия Next | **16.x** (как admin-ui 16.1.6) | Единый стек с админкой, общий опыт команды, Turbopack в dev |
| React | 19.2.x | Совместим с admin-ui; storefront'ы уже на 19 |
| Router | App Router (не Pages) | Будущее Next; layout'и = RootLayout; metadata API — для SEO |
| Компоненты | Все существующие — `'use client'` | Перенос 1:1, SSR-HTML автоматически; RSC — не в этой миграции |
| Tailwind | **v3.4 + тот же tailwind.config.ts** | Дизайн 1:1; апгрейд на v4 — отдельная задача после стабилизации |
| Состояние | Context + localStorage как есть | Ноль риска; серверный cart — вне scope |
| Изображения | Обычные `<img>` как сейчас; `next/image` — потом | `unoptimized: true`; дизайн 1:1, ленивость уже реализована в компонентах |
| Вывод сборки | `output: 'standalone'` | Компактный Node-контейнер |
| Монорепо/pnpm | Нет — отдельный репозиторий `server-shop-sp-next`, npm | Конвенция STOREFRONTS.md: каждый скин = свой репозиторий |

### 4.2. Структура нового проекта

```
server-shop-sp-next/
├── app/                          # маршрутизация (App Router)
│   ├── layout.tsx                # <html>/<head>, шрифты, Providers, Header/Footer
│   ├── page.tsx                  # HomePage
│   ├── globals.css               # ← src/index.css (токены, @fontsource)
│   ├── catalog/page.tsx          # /catalog
│   ├── catalog/[slug]/page.tsx   # /catalog/{slug}
│   ├── product/[slug]/page.tsx
│   ├── configurator/page.tsx
│   ├── build/[token]/page.tsx
│   ├── checkout/page.tsx
│   ├── blog/page.tsx
│   ├── blog/[slug]/page.tsx
│   ├── contacts/page.tsx
│   ├── unsubscribe/page.tsx
│   ├── privacy/withdraw/page.tsx
│   ├── account/page.tsx
│   ├── account/[tab]/page.tsx
│   ├── account/orders/[orderId]/page.tsx
│   ├── not-found.tsx             # ← NotFoundPage
│   ├── error.tsx                 # ← ErrorBoundary (роут-уровень)
│   ├── global-error.tsx          # ← ErrorBoundary (корневой)
│   ├── api/healthz/route.ts      # healthcheck для compose
│   └── robots.ts                 # (опц.) если уберём robots у бэкенда — нет, оставить у Caddy/бэкенда
├── src/                          # ВЕСЬ существующий код без перемещений
│   ├── components/  (ui/, layout/, ... )   # + 'use client' наверху файлов
│   ├── hooks/       lib/  store/  data/  assets/
│   └── (router.tsx, main.tsx, vite-env.d.ts — НЕ переносятся)
├── public/                       # ← весь public старого проекта (favicon, img, poster, ...)
├── docs/
│   ├── MIGRATION-PLAN.md         # этот документ
│   ├── MIGRATION-LOG.md          # журнал отклонений = рецепт для sale-ui
│   └── ...                       # STOREFRONT-API контракт-ссылки
├── next.config.ts
├── tailwind.config.ts            # без изменений (content: добавить app/**)
├── postcss.config.js             # как был
├── tsconfig.json                 # paths: "@/*": ["./src/*"]
├── Dockerfile                    # standalone Node (раздел 11)
├── docker-compose.prod.yml       # по образцу старого
└── package.json
```

Файлы `src/` **не переименовываются и не перемещаются** — переносится весь каталог
целиком; страница-компонент из `src/pages/X.tsx` становится тонкой обёрткой в
`app/x/page.tsx` (`export default` → рендер `<X />`).

---

## 5. Слой 1 — каркас и инфраструктура

### 5.1. package.json (дельты зависимостей)

**Убрать:** `react-router-dom`, `vite`, `@vitejs/plugin-react`, `terser`,
`@types/…` — оставить, кроме vite-специфики.
**Добавить:** `next@16`, `eslint` + `eslint-config-next@16` (lint обязателен для
Next build; заметка: в admin-ui линт-конфиг сломан FlatCompat'ом — здесь делаем
минимальный `next/core-web-vitals + next/typescript` без самодеятельности).
**Оставить как есть:** react/react-dom 19, tailwindcss 3.4, postcss, autoprefixer,
все radix-*, framer-motion, lucide, react-markdown и пр.

Скрипты:

```json
"dev": "next dev --turbopack",
"build": "next build",
"start": "next start",
"lint": "next lint",
"typecheck": "tsc --noEmit"
```

### 5.2. Переменные окружения

| Vite | Next | Серверу видна | Назначение |
|---|---|---|---|
| `VITE_API_BASE_URL` | `NEXT_PUBLIC_API_BASE_URL` + дубликат `API_BASE_URL` (для серверного fetch в generateMetadata) | да/да | база `/api/v1` |
| `VITE_APP_URL` | `APP_URL` (только сервер) | да | канонический origin в metadata |
| `VITE_MEDIA_BASE_URL` | `NEXT_PUBLIC_MEDIA_BASE_URL` | да/да | preconnect к origin картинок |

`import.meta.env.VITE_*` в коде — единственное место чтения: `lib/api-base.ts`;
переписать на `process.env.NEXT_PUBLIC_*` с фолбэком. В `api-base.ts` добавить
экспорт `API_BASE_SERVER` (без `NEXT_PUBLIC_`, для серверных вызовов).

`.env.example` / `.env.prod.example` — новые имена, тот же набор. Docker build-args
переименовываются соответственно.

### 5.3. index.html → app/layout.tsx

Перенос из `index.html`:

| Что в index.html | Куда в Next |
|---|---|
| `<html lang="ru">`, charset, viewport | `app/layout.tsx` (корневая разметка) |
| favicon.svg | `<link rel="icon">` в layout (или metadata.icons) |
| preload постера Hero (`/main-poster-800.webp`, imagesrcset, fetchpriority) | `<link>` в `<head>` layout'а — дословно |
| `<title>` + `<meta description>` | фолбэк в `generateMetadata` корня (перекрывается постранично) |
| критический CSS-скелет `#root:empty` + spinner | **НЕ переносится** — SSR красит реальный HTML мгновенно; скелет не нужен |
| `<noscript>` со ссылками | в body layout'а дословно |
| `main.tsx` → `initConsent()` | клиентский `Providers` + `useEffect(() => { void initConsent(); }, [])` |

Шрифты: импорты `@fontsource` остаются в `globals.css`. Preload `roboto-condensed`
woff2 — явными `<link rel="preload" as="font" crossorigin>` в layout (вместо
vite-плагина `inlineCss`); `font-display: optional` уже зашит в CSS пакетов
fontsource — оставить.

### 5.4. Tailwind/PostCSS

`tailwind.config.ts` копируется дословно, в `content` добавить `"./app/**/*.{ts,tsx}"`.
`postcss.config.js` без изменений. `globals.css` = `src/index.css` (перенос
целиком, включая design-токены и все кастомные слои).

### 5.5. next.config.ts (стартовый)

```ts
const nextConfig = {
  output: "standalone",
  images: { unoptimized: true },      // <img> как сейчас; next/image — потом
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
};
```

Редиректы (бывшие `<Navigate>`) — см. 6.3: часть в `next.config` → `redirects()`,
часть — серверные `redirect()` в страницах (там, где нужна семантика 301 для SEO).

---

## 6. Слой 2 — маршрутизация

### 6.1. Таблица роутов sp-ui → App Router

| react-router | App Router | Файл страницы |
|---|---|---|
| `/` (index) | `/` | `app/page.tsx` ← `pages/HomePage` |
| `catalog` | `/catalog` | `app/catalog/page.tsx` ← `CatalogPage` |
| `catalog/:slug` | `/catalog/[slug]` | `app/catalog/[slug]/page.tsx` |
| `product/:slug` | `/product/[slug]` | `app/product/[slug]/page.tsx` |
| `configurator` | `/configurator` | `app/configurator/page.tsx` |
| `build/:token` | `/build/[token]` | `app/build/[token]/page.tsx` |
| `cart` → Navigate `/checkout` | 301 в `next.config.redirects` | — |
| `checkout` | `/checkout` | `app/checkout/page.tsx` |
| `blog` | `/blog` | `app/blog/page.tsx` |
| `blog/:slug` | `/blog/[slug]` | `app/blog/[slug]/page.tsx` |
| `contacts` | `/contacts` | `app/contacts/page.tsx` |
| `about, faq, delivery, warranty, tradein, services, monitoring` → Navigate `/blog/...` | 301 в `redirects()` (7 шт.) | — |
| `unsubscribe` | `/unsubscribe` | `app/unsubscribe/page.tsx` |
| `privacy/withdraw` | `/privacy/withdraw` | `app/privacy/withdraw/page.tsx` |
| `account` | `/account` | `app/account/page.tsx` |
| `account/:tab` | `/account/[tab]` | `app/account/[tab]/page.tsx` |
| `account/orders/:orderId` | `/account/orders/[orderId]` | `app/account/orders/[orderId]/page.tsx` |
| `*` (404) | `not-found.tsx` | ← `NotFoundPage` |
| `errorElement` | `error.tsx` + `global-error.tsx` | ← `ErrorBoundary` |

⚠️ Порядок `/account/[tab]` и `/account/orders/[orderId]`: в App Router статичный
сегмент `orders` выигрывает у динамического `[tab]` — конфликтов нет.

⚠️ `ConfiguratorPage` внутренне использует `<Navigate>` — заменить на
`useRouter().replace()` (клиентский) или серверный `redirect()` по условию.

`lazyNamed`/`Suspense` из `router.tsx` не переносятся: код-сплиттинг по роутам
делает App Router автоматически; `<Suspense fallback={<div className="min-h-[60vh]" …>}`
→ `loading.tsx` в каждой папке роута (тот же класс).

### 6.2. Замена react-router API (механическая, ~35 файлов в sp-ui)

Сверить полный список: `grep -l "react-router-dom" src -r`.

| react-router | Next | Заметки |
|---|---|---|
| `<Link to="/x">` | `<Link href="/x">` | 1:1; `<a>` для внешних ссылок уже так |
| `useNavigate()` | `useRouter()` (`next/navigation`) | `.push`/`.replace` те же; `navigate(0)` → `router.refresh()` |
| `useParams()` | `useParams()` | совместим |
| `useSearchParams()` | `useSearchParams()` | ⚠️ в client-компоненте требует `<Suspense>`-обёртку страницы (в Next это обязательное условие при SSR/prerender) |
| `useLocation()` | `usePathname()` + `useSearchParams()` | разложить по использованию (`.pathname`, `.search`, `.key` → убрать) |
| `<Outlet />` | `{children}` в layout | RootLayout превращается в `app/layout.tsx` |
| `<Navigate to replace />` | `redirect()` (сервер) или `router.replace` | см. 6.3 |
| `<ScrollRestoration />` | убрать | Next восстанавливает скролл сам; там где был `navigate(..., { state, preventScrollReset })` — `router.push(url, { scroll: false })` |
| `RouterProvider`, `createBrowserRouter` | — | удалить `router.tsx`, `main.tsx` |

### 6.3. Редиректы (важно для SEO-паритета)

Легаси-URL (`/about` → `/blog/about` и др.) сейчас работают через `<Navigate
replace>` — это клиентский редирект **без HTTP-статуса** для SPA, но бот-HTML
бэкенда отдаёт по ним 301. Чтобы не потерять SEO, в Next эти редиректы делаем
**HTTP-уровнем** в `next.config.ts → redirects()` со `statusCode: 301`:

```ts
async redirects() {
  return [
    { source: "/cart", destination: "/checkout", permanent: true },
    { source: "/about", destination: "/blog/about", permanent: true },
    // faq, delivery, warranty, tradein, services, monitoring — аналогично
  ];
}
```

Динамические 301 (смена slug, легаси `/catalog?category=`) остаются за
SeoDocument-контрактом: серверная страница читает `redirect_to` и делает
`redirect(target, 301)` до рендера (см. 7.2) — семантика P0.2/P0.4 сохраняется.

---

## 7. Слой 3 — перенос кода и SEO

### 7.1. Порядок переноса каталогов src/

1. **Без изменений вообще:** `components/ui/*` (Radix-обёртки — все SSR-safe),
   `lib/` (кроме api-base), `data/`, `assets/`, `hooks/` (см. аудит окна в 7.3).
2. **Мелкие правки:** `'use client'` директива наверху всех компонентов/страниц/
   store; замены react-router по таблице 6.2; `api-base.ts` (env).
3. **Переписывание:** `router.tsx`, `main.tsx`, `components/layout/RootLayout.tsx`
   (→ `app/layout.tsx`), `components/layout/DocumentHead.tsx` (→ серверный
   metadata + облегчённый клиентский остаток).

### 7.2. SEO-слой (ключевая ценность миграции)

**Штатный режим (цель):** каждый `app/**/page.tsx` экспортирует `generateMetadata`:

```ts
export async function generateMetadata({ params, searchParams }): Promise<Metadata> {
  const doc = await fetchSeoDocumentServer(path, searchParams); // серверный fetch /seo/document
  if (doc?.redirect_to) redirect(toLocalPath(doc.redirect_to), 301); // легаси-301 на сервере
  return seoDocToMetadata(doc); // title, description, robots, OG, canonical, product:price, twitter
}
```

- `fetchSeoDocumentServer` — серверная версия существующего `fetchSeoDocument`
  из `lib/api.ts` (без localStorage/токенов; базовый URL из серверного env).
- JSON-LD блоки — `<script type="application/ld+json" dangerouslySetInnerHTML>`
  в серверной странице (паразитные копии из клиентского `DocumentHead` не
  создаются, т.к. клиентский вариант отключается).
- **Поэтапный отказ от клиентского DocumentHead:** фаза 1 — он остаётся как
  страховка для SPA-переходов (SPA-навигация не вызывает generateMetadata —
  в Next метаданные роутов применяются клиентом автоматически, поэтому старый
  `DocumentHead` упрощается до «ничего не делать при клиентской навигации»);
  фаза 2 — удалить полностью, метаданными управляет только Next.
- **Бот-HTML бэкенда:** при параллельной эксплуатации не трогаем. После недели
  стабильного SSR — выводим из цепочки (отдельная задача в server-shop: убрать
  bot-матчер из Caddy/бэкенда для этого скина). Sitemap/robots остаются у
  бэкенда — не трогаем.
- `titleFromPath`-фолбэки и `formatPageTitle` переносим в серверные метаданные
  (Map'а из DocumentHead достаточно).
- Метрика: серверный HTML содержит счётчик как сейчас (`syncHeadSnippets` /
  noscript-код), `trackHit` при клиентской SPA-навигации остаётся в клиенте.
- Статические OG-фолбэки в shell (бывший vite-плагин `seoShellMeta`) →
  `metadata` корневого layout'а из `APP_URL`.

### 7.3. Аудит гидрации (обязательный чек-лист перед каждой страницей)

Греп-паттерны по `src/`: `localStorage`, `window.`, `document.`, `Math.random`,
`Date.now`, `new Date`, `crypto`. Известные точки:

| Место | Риск | Лечение |
|---|---|---|
| `store/shop.tsx` — инициализация из localStorage | SSR отдаст пустую корзину, у клиента она есть → hydration mismatch | уже lazy-init? проверить; иначе `useState(empty)` + `useEffect`-чтение (паттерн «hydrate from storage») |
| `store/auth.tsx` — токен из localStorage | то же | тот же паттерн |
| `lib/api.ts` getAuthToken/getCartToken | вызовы в render? | только в эффектах/обработчиках — проверить |
| `hooks/useViewportFill` | window в теле | гвард `typeof window` / useEffect |
| `lib/analytics/metrica.ts`, `lib/consent` | window/document | только в эффектах |
| framer-motion | SSR-safe | ничего |
| Radix | SSR-safe | ничего |
| Даты в карточках (акции, «сегодня») | возможный mismatch | сверить рендер-чистоту |

Правило: **ничего браузерного в теле render** — только в `useEffect`/обработчиках.
Места, где без этого нельзя (например содержимое корзины в Header) —
`suppressHydrationWarning` точечно + затемнение до монтирования (тот же визуал,
что skeleton сейчас).

---

## 8. Слой 4 — сборка и деплой

### 8.1. Dockerfile (standalone)

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_API_BASE_URL=...
ARG NEXT_PUBLIC_MEDIA_BASE_URL=...
ARG APP_URL=...
ARG API_BASE_URL=...
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

Заметки:
- `NEXT_PUBLIC_*` обязаны присутствовать на этапе build (вшиваются в клиентский
  бандл); серверные (`APP_URL`, `API_BASE_URL`) можно и через env в runtime.
- healthcheck: `app/api/healthz/route.ts` → `wget -qO- http://127.0.0.1:3000/api/healthz`.
- Память: Next SSR тяжелее nginx-статики — поднять `mem_limit` с 256m до
  **512m** (и `cpus: 0.75`), после наблюдения — скорректировать.
- `npm ci` в CI-окружении DSH: помнить квирку `--ignore-scripts --cache` — но
  это только для локальной песочницы, в Docker всё штатно.

### 8.2. docker-compose.prod.yml

Копия текущего с изменениями: образ `server-shop-sp-next`, порт 3000,
`STOREFRONT_ALIAS` — **тот же алиас в сети `shop`** (Caddy не меняется),
build-args по 5.2, mem_limit 512m.

### 8.3. Caddy / сервер

Без изменений: Caddy проксирует на алиас контейнера витрины в сети `shop`.
Переключение = смена работающего контейнера с этим алиасом (см. фазу 7).
На сервере: `scripts/update.sh` нового репо (адаптировать), GHCR-образ —
по образцу старого CI (`docker-compose.publish.yml` + `.github/workflows`).

---

## 9. Фазы работ

Потоки Ф1–Ф4 частично параллелятся (владение файлами не пересекается).

### Ф0. Каркас (поток A)
Next 16 + TS + Tailwind3 + globals.css + шрифты + layout c Header/Footer +
`/api/healthz` + Dockerfile + compose + `next dev` поднимается.
**DoD:** localhost:3000 рисует шапку/подвал с теми же токенами; `next build`
зелёный (в песочнице DSH финальный spawn может упасть EPERM — это норма,
проверять сборку локально/CI).

### Ф1. Ядро без роутинга (поток A)
Перенос `src/{components,lib,hooks,data,store,assets}` + `public/`; env-замены;
`'use client'`; аудит-чек 7.3 по списку.
**DoD:** `tsc --noEmit` зелёный; grep `react-router-dom` внутри src → 0 (кроме
файлов, запланированных к переписыванию).

### Ф2. Роутинг (поток B — параллельно Ф1 по готовности Ф0)
Все `app/**/page.tsx` обёртки; таблица 6.1; redirects() из 6.3; error/not-found;
loading.tsx.
**DoD:** все 14 страниц открываются на dev-сервере; редиректы отдают 301 (curl).

### Ф3. SEO (поток C)
`generateMetadata` на всех страницах; серверный fetchSeoDocument; `redirect_to`
→ `redirect(…, 301)`; JSON-LD в SSR; корневые фолбэки.
**DoD:** curl страницы товара возвращает полный head (title/desc/OG/canonical/
JSON-LD/product:price) без JS; легаси-URL → Location 301; `?category=`-формат →
301 (как сейчас делает SeoDocumentBuilder).

### Ф4. Страничная доводка (поток C/D, параллельно)
Пошагово включить и проверить интерактив каждой страницы (фильтры каталога,
конфигуратор с поиском, чекаут, кабинет с токеном, сравнение, cookie-баннер).
**DoD:** чек-лист пользовательских сценариев (раздел 12.2) закрыт.

### Ф5. Сборка/CI (поток A)
Docker build + GHCR publish + update.sh; secrets по DEPLOY.md; CI: build + lint
+ typecheck.
**DoD:** образ собирается в CI; compose up на тестовой VPS/порту здоров.

### Ф6. Параллельная эксплуатация
Старый sp-ui работает как раньше; новый поднят на отдельном порту/поддомене
(например `next.домен` через отдельный алиас в Caddy), по нему идут проверки.
**DoD:** все проверки раздела 12 зелёные.

### Ф7. Переключение
Смена контейнера-держателя алиаса (или upstream в Caddy) на новый; старый образ
остаётся на сервере для отката. Наблюдение: Lighthouse, Search Console, ошибки
гидрации в логах, конверсия чекаута.
**DoD:** 7 дней без регрессий (SEO + функциональность + производительность).

### Ф8. Удаление чистого React
Архив ветки/тэг последнего состояния `server-shop-sp-ui`, затем удаление репо
(или перевод в archived на GitHub). Убрать старый контейнер/образ. Обновить
`server-shop/docs/STOREFRONTS.md` (новое имя репо витрины) — PR в server-shop.

### Ф9. sale-ui по рецепту (отдельный план поверх MIGRATION-LOG)
Раздел 15.

**Оценка относительных объёмов:** Ф0 — S; Ф1 — M; Ф2 — M; Ф3 — M; Ф4 — L;
Ф5 — S; Ф6 — M (тестирование); Ф7–Ф8 — S.

---

## 10. Риски и снятие

| # | Риск | Вероятность | Снятие |
|---|---|---|---|
| 1 | Hydration mismatch (localStorage-состояние, даты, рандом) | высокая | аудит 7.3 до переноса каждой страницы; паттерн «пустой SSR → эффект-гидрация»; точечный suppressHydrationWarning |
| 2 | Расхождение дизайна (шрифты/скролл/скелеты) | средняя | Tailwind3 без изменений; скриншот-сравнение 12.1; критический CSS-скелет удаляем осознанно (SSR) — визуально страница появляется сразу |
| 3 | Потеря легаси-301/каноник | высокая (SEO-критично) | Ф3 тестируется curl'ом по полному списку легаси-URL из SeoDocumentBuilder; константа P0.4 «плоские ЧПУ, /product/{slug} без категории» — не регрессить |
| 4 | useSearchParams без Suspense → build error | высокая | обёртки страниц в `<Suspense>`; известный гоча Next |
| 5 | Бот-HTML и SSR конфликтуют (двойные метатеги) | средняя | при параллельной работе бот-HTML остаётся; в переключённом состоянии Caddy перестаёт матчить ботов для этого скина; клиентский DocumentHead упрощается по 7.2 |
| 6 | Node-рантайм тяжелее nginx (память/CPU) | средняя | mem_limit 512m, наблюдение Ф7; standalone-режим минимальный |
| 7 | ESLint-конфиг Next 16 (урок admin-ui) | средняя | минимальный конфиг `next/core-web-vitals` без FlatCompat-манипуляций |
| 8| `next build` в DSH-песочнице падает на spawn-этапе | гарантированная | известная квирка окружения: валидировать сборку в Docker/CI, в песочнице — tsc + dev-сервер |
| 9 | Ссылки-якоря/`to={{pathname,search}}` объектные | низкая | grep `to={{` при Ф2; переписать в строковые href |

---

## 11. Тестирование паритета

### 11.1. Дизайн-паритет
Playwright-скрипт: список ~30 URL (все роуты + вариации фильтров/табов), вьюпорты
390/768/1440/1920; скриншоты старого (порт 5173 `vite preview`) и нового (3000);
порог различия — 0 для контентных зон (допустимы только: отсутствие спиннера
загрузки, динамический контент — акции/счётчики). Отчёт в `docs/`.

### 11.2. Функциональный чек-лист (минимум)
- Каталог: фильтры (бренд/состояние/атрибуты/цена), сортировка, пагинация,
  ЧПУ-параметры в URL (источник истины), «под заказ».
- Карточка: галерея/зум, гарантия, добавление в корзину, сравнение, related.
- Конфигуратор: сборка, расчёт, шаринг `/build/{token}`, печать.
- Корзина/чекаут: qty, промокод, бонусы, реквизиты-файл, быстрый заказ (sale-ui),
  оформление гостем и с аккаунтом.
- Аккаунт: логин/регистрация/верификация, адреса, юрлица, бонусы, заказы, tab'ы.
- Блог/статья: markdown,OG.
- Cookie-баннер (152-ФЗ): метрика стартует только после согласия.
- 404, error boundary (имитация ошибки), `/cart` → 301 `/checkout`.

### 11.3. SEO-паритет
Для каждого тестового URL сравнить со старым (curl, UA=Googlebot и обычный):
title, description, canonical, robots, OG-набор, product:price, JSON-LD-блоки;
легаси-URL → 301 в тот же Location; `?category=`-формат → 301; sitemap/robots
не изменились. Lighthouse SEO = 100 на ключевых страницах.

### 11.4. Производительность
Lighthouse (mobile) до/после: ожидаем улучшение LCP/FCP за счём SSR;
бандж-сайз клиента не должен вырасти >10% (потеря ручных vendor-чанков
компенсируется автосплитом App Router; terser drop_console → eslint no-console
+ свифт-минификация Next).

---

## 12. Критерии приёмки (гейты перед Ф7/Ф8)

1. Все страницы из 11.1 — визуально идентичны (отчёт приложен).
2. Чек-лист 11.2 — 100% пройден на тестовом стенде.
3. SEO-паритет 11.3 — расхождений нет (кроме осознанных улучшений, задокументированных).
4. `next build` зелёный в CI; eslint/tsc — зелёные.
5. 7 дней на домене-дубле без 5xx/hydration-ошибок в логах.
6. MIGRATION-LOG.md заполнен — рецепт готов для sale-ui.

---

## 13. Документация (обязательства AGENTS.md)

- `server-shop-sp-next/docs/` — MIGRATION-PLAN (этот файл), MIGRATION-LOG,
  README (запуск, env, деплой по образцу DEPLOY.md), агент-доки при изменении
  контрактов.
- Контракт Storefront API не меняется: `server-shop/docs/STOREFRONT-API.md`
  трогать не нужно. Единственный PR в server-shop — обновление
  `docs/STOREFRONTS.md` (имя нового репо витрины) на этапе Ф8.
- В старом `server-shop-sp-ui` — тэг `pre-nextjs-freeze` перед Ф8.

---

## 14. Что НЕ входит в scope (осознанно)

- Переезд Tailwind 3 → 4.
- Server Components / частичный RSC, серверный cart.
- `next/image` и image optimization.
- Перенос ботов/SEO-рендера из Laravel (SeoDocumentBuilder) — только после
  стабилизации, отдельной задачей в server-shop.
- i18n,改变的 состояния (Zustand/Redux), дизайн-правки любого рода.

---

## 15. Рецепт для sale-ui (после успеха pilot'а)

Выполняется по MIGRATION-LOG pilot'а + этот раздел. Дельта sale-ui:

| Отличие от sp-ui | Действие |
|---|---|
| +12 файлов: QuickOrderButton, BenefitsSection, TilesSection, CategoryNav, ProductPhoto, data/{faq,info,requisites,reviews}, lib/{homeText,nav}, pages/info/ProposalPage | переносятся тем же порядком (Ф1) |
| `ui/breadcrumbs.tsx` (Link) | + замена Link по 6.2 |
| Роут `proposal` (+ `/konfigurator` алиас конфигуратора!) | `app/proposal/page.tsx`; `redirects()`: `/konfigurator` → `/configurator` (сейчас это два роута на одну страницу) |
| Разные SEO-фолбэки titleFromPath | перенести в серверные метаданные |
| Свой VITE_APP_URL / OG-фолбэки | env отдельного инстанса |
| CI/GHCR | копия workflow нового sp-next |

Остальное (95% кода) — идентично; все уроки гидрации из MIGRATION-LOG
применяются сразу.

---

## 16. С чего начать (first commit)

1. `mkdir server-shop-sp-next && git init` — каркас Ф0 (`create-next-app`-структура
   вручную, без шаблона).
2. Скопировать `public/`, `tailwind.config.ts`, `postcss.config.js`, `src/` (без
   router.tsx/main.tsx/vite-env.d.ts).
3. `app/layout.tsx` + `globals.css` + шрифты → проверка Header/Footer.
4. Далее Ф1–Ф2 по параллельным потокам.
