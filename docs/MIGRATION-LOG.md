# Журнал миграции sp-ui → sp-next (рецепт для sale-ui)

> Этот документ — «как реально пошло» против плана. При миграции
> `server-shop-sale-ui` выполнять шаги отсюда, сверяясь с планом.

## Ф0–Ф1. Каркас и перенос кода

- ✅ `src/`, `public/`, `tailwind.config.ts` скопированы целиком (103 + 6
  файлов). `src/router.tsx`, `src/main.tsx`, `src/vite-env.d.ts` не переносились.
- ⚠️ **Шрифты**: в sp-ui не Roboto Condensed (это sale-ui!), а
  **Inter Variable** (`@fontsource-variable/inter`, импорт в index.css).
  4 woff2-подмножества (latin, latin-ext, cyrillic, cyrillic-ext) скопированы в
  `public/fonts/`, `@import` заменён на локальные `@font-face` c
  `font-display: optional` (эквивалент vite-плагина inlineCss). Preload
  cyrillic+latin — в `app/layout.tsx`.
- ✅ `api-base.ts`: `import.meta.env.VITE_API_BASE_URL` →
  `process.env.NEXT_PUBLIC_API_BASE_URL` (+ серверная `API_BASE_URL`,
  + `MEDIA_BASE_URL`). Других использований vite-env в коде не было.
- ✅ RootLayout → `src/components/layout/SiteChrome.tsx` (client): те же
  провайдеры/порядок; `<Outlet/>` → `{children}`, `<ScrollRestoration/>`
  удалён, `initConsent()` перенесён в `useEffect` (был в main.tsx).
- ✅ DocumentHead переписан: серверные метаданные —
  `src/lib/seo-server.ts` (fetchSeoDocumentServer/fetchSiteServer — серверные
  копии без localStorage) + `src/lib/seo-page.tsx` (pageSeo → Metadata,
  redirect_to → permanentRedirect 308, JsonLd-компонент). Клиентский остаток —
  `usePageMeta` (только document.title) + `ClientHead` (trackHit при SPA-переходах).
- ✅ `syncHeadSnippets` (head-сниппеты из админки) оставлены клиентскими —
  выполняются после hydrate, как в SPA.

## Ф1. Кодмод react-router → next

Скрипт `scripts/codemod-router.mjs` (идемпотентный), затем ручная доводка.

Замены (33 файла):

| react-router | next | Примечание |
|---|---|---|
| `import { Link } from "react-router-dom"` | `import Link from "next/link"` | `<Link to=` → `href=` |
| `useNavigate()` | `useRouter()` | `navigate(x, {replace})` → `router.replace(x)`, `navigate(x)` → `router.push(x)` |
| `useLocation()` | `usePathname()` | `location.pathname` → `pathname` |
| `useParams()` | `useParams()` | ⚠️ тип `string \| string[]` — нужен runtime-guard |
| `useSearchParams()` `[a, setA]` | `useSearchParams()` (только чтение) | `setSearchParams(next, {replace:true})` → `router.replace(pathname + '?' + qs)` |

Ручные фиксы после кодмода:

1. **`<Navigate>` в ConfiguratorPage** → `useEffect(() => { if (slug) router.replace(...) }, [slug, router])` + скелет на время ухода.
2. **`setSearchParams`** в BlogPage (1 место) и CatalogPage (3 места) → хелпер `applyParams(next)` = `router.replace(pathname + '?' + qs)`.
3. **Footer** имел второй импорт `Link as RouterLink` — кодмод заменил `to=`, но не `<RouterLink>`: заменили вручную на `next/link`.
4. Кодмод оставлял alias-импорты (`usePathname as useLocation`), но заменял вызовы на прямые имена — выровнено скриптом.
5. `navigate(`/…`, { replace: true })` многострочно в SharedBuildPage — регекс кодмода не взял, вручную → `router.replace(...)`.

## Ф1. 'use client'

Скрипт `scripts/add-use-client.mjs`: помечены все `src/components/**`,
`src/views/**` (бывшие pages), `src/store/**`, `src/hooks/**` (84 файла).
`src/lib/**` и `src/data/**` остались без директивы (server-safe).

## ⚠️ КРИТИЧЕСКАЯ ЛОВУШКА: src/pages/

**Next.js воспринимает `src/pages/` как Pages Router** и падает:
`Error: > "pages" and "app" directories should be under the same folder`.
Каталог переименован в **`src/views/`**, импорты `@/pages/` → `@/views/`.
Для sale-ui: переименовывать СРАЗУ при копировании.

## Ф2. Роуты

- Все 14 страниц = тонкие серверные обёртки в `app/**/page.tsx`
  (рендер view-компонента + `<JsonLd/>`), `export const dynamic = "force-dynamic"`.
- 9 бывших `<Navigate>`-редиректов → `redirects()` в next.config
  (`permanent: true` → **308**). curl: `/cart` → Location `/checkout`. ✅
- `not-found.tsx` (NotFoundPage), `error.tsx` (UI как ErrorBoundary + reset),
  `loading.tsx` (тот же fallback, что Suspense в router.tsx).
- `app/api/healthz/route.ts` для docker healthcheck.

## Ф3. SEO

- `generateMetadata` на каждой странице: путь с query → `/seo/document` →
  полный набор (title absolute / description / robots / canonical / OG /
  twitter / product:price:* / JSON-LD через `<JsonLd/>`).
- `redirect_to` → `permanentRedirect` (**308**; бот-HTML отдавал 301 —
  для GET-семантики эквивалентно).
- Фолбэки: PATH_TITLES (titleFromPath из DocumentHead) + site-тайтл.
- Корневой `app/layout.tsx`: metadataBase из APP_URL, OG-фолбэки из
  /settings/site (эквивалент seoShellMeta-плагина), preload шрифтов и
  hero-постера (из index.html), noscript-фолбэк, preconnect к медиа-origin.

## Ф4. Проверки (dev-сервер, порт 3100)

- tsc --noEmit: **зелёный**.
- Все 15 маршрутов + динамические: 200, SSR-HTML 53–69KB, ошибок гидрации
  в логах нет; 404 отдаётся корректно; `/api/healthz` → `{"status":"ok"}`.
- Заголовок/подвал/site-chrome/FAB рендерятся в SSR (проверено маркерами).

## Окружение DSH (квирки, воспроизведённые из MEMORY)

- `npm.ps1` блокируется execution-policy → `npm.cmd` / `npx.cmd` напрямую.
- `npm install` — с `--ignore-scripts --cache .npm-cache`.
- `next dev` требует spawn (EPERM в read-only) → danger-full-access, фоново.
- `next dev` переписал tsconfig (jsx → react-jsx, include .next/dev/types) —
  это норма Next.
- Turbopack предупреждал о root из-за lockfile выше по дереву →
  `turbopack: { root: path.resolve(__dirname) }` в next.config.
- `allowedDevOrigins` для 127.0.0.1 (иначе warning о cross-origin).

## Тесты (2026-09-13, локальная машина)

- ✅ `tsc --noEmit` — зелёный.
- ✅ `next build` — **зелёный, 17 роутов** (все Dynamic/SSR). Потребовались
  два фикса пререндера `/_not-found`:
  1. Suspense вокруг `{children}` в app/layout.tsx;
  2. Suspense вокруг `<Header/>` в SiteChrome (Header использует
     useSearchParams — на статических страницах Next требует границу).
- ✅ Прод-сервер (`next start`): браузерный тест (agent-browser/Chrome 153,
  headless) — **консоль чистая: ноль hydration-ошибок**.
  ⚠️ Dev-режим (Turbopack) давал ложный aria-controls/useId mismatch —
  известная специфика dev; на проде не воспроизводится. Не тратить время
  на dev-варнинги гидрации, проверять на `next start`.
- ✅ Гидрация worst-case (localStorage с корзиной/compare/favorites) — чисто;
  паттерн «пустой SSR → hydrate-from-storage effect» в store/shop.tsx и
  store/auth.tsx работает (compare-bar появляется после mount).
- ✅ SPA-навигация: клик CTA «Перейти в каталог» → /catalog без reload,
  document.title = «Каталог» (метаданные роута применились).
- ✅ Редиректы: /cart, /about, /faq, /delivery, /warranty, /tradein,
  /services, /monitoring → 308 Permanent Redirect на /blog/*.
- ✅ Фолбэк-тайтлы всех страниц идентичны SPA (вкл. /unsubscribe → site-тайтл,
  как в titleFromPath).
- ✅ 404, /api/healthz → ok.
- ✅ Скриншоты: sp-next-test-artifacts/{home, catalog}-prod.png; DOM-snapshot
  главной: полная структура (шапка/hero/футер/подписка/152-ФЗ).
- Git: root-commit 64e195d.

### Не проверено локально (нет бэкенда на 8080)

- Полный SEO-паритет (OG/canonical/JSON-LD/product:price из /seo/document) —
  работает фолбэками; проверять на сервере с живым API (Ф6).
- Скриншот-сравнение старое vs новое по 30 URL × 4 вьюпорта (нужен живой
  каталог с товарами).
- Docker build/runtime.

## Для sale-ui (дельта поверх этого рецепта)

- +12 файлов (QuickOrderButton, BenefitsSection, TilesSection, CategoryNav,
  ProductPhoto, data/{faq,info,requisites,reviews}, lib/{homeText,nav},
  pages/info/ProposalPage) — переносятся тем же порядком.
- `ui/breadcrumbs.tsx` есть и там — кодмод покроет.
- Роут `proposal` → `app/proposal/page.tsx`; **алиас `/konfigurator` →
  redirect на `/configurator`** (в SPA это два роута на одну страницу).
- Шрифты: у sale-ui **Roboto Condensed** (400/300/500/700, не variable!) —
  скопировать 8 файлов (latin+cyrillic × 4 веса) из
  `@fontsource/roboto-condensed/files`, preload критичных.
- titleFromPath в sale-ui шире (proposal и др.) — перенести полный список.

## CI/CD + миграция в один клик (Ф5/Ф6-инструменты)

Ключевое архитектурное решение: **Caddy не трогаем**. Caddy проксирует на
сетевой алиас `shop_storefront:80` (см. server-shop/docker/caddy/Caddyfile.example),
поэтому Next-контейнер слушает **:80** (compose `PORT=80`, standalone server.js) —
полная совместимость с upstream старого nginx. Переключение витрины = смена
владельца алиаса в сети `shop`.

Добавлено:

- `.github/workflows/ci.yml` — typecheck + build (NEXT_PUBLIC_* env для сборки).
- `.github/workflows/images.yml` — GHCR `server-shop-sp-next`; build-args из
  repository Variables `NEXT_PUBLIC_API_BASE_URL` / `NEXT_PUBLIC_MEDIA_BASE_URL` /
  `API_BASE_URL` / `APP_URL` (⚠️ это НОВЫЕ имена переменных — в старом репо
  были VITE_*; завести в Settings → Secrets and variables → Actions → Variables).
- `.github/workflows/deploy.yml` — SSH → update.sh (копия схемы sp-ui).
- `scripts/lib-github.sh` — копия из sp-ui без изменений.
- `scripts/update.sh` — адаптация под Next: smoke `wget :80/api/healthz` +
  `<title` в SSR-HTML + grep API-URL в `.next/static` (ловим образ с чужим
  NEXT_PUBLIC_ конфигом); внешний smoke по `APP_URL`.
- `scripts/lib-migrate.sh` — логика миграции (библиотека, вызывается из update.sh).
- **`scripts/update.sh --migrate`** — **один клик** (миграция интегрирована в
  единый деплой-скрипт): конвертация старого `.env.prod` (VITE_*→NEXT_*, копия
  GH_TOKEN/алиаса/сети) → canary-деплой под `sp-next-canary` (прод продолжает
  работать) → `compose down` старой витрины → `up` Next с прод-алиасом →
  внешний smoke → **автовой старой витрины при провале** → запись
  `.deploy-state` (цель будущих откатов). Флаги: `--old-ui`, `--dry-run`,
  `--keep-images`.
  **Автоопределение:** `update.sh` без флагов при отсутствии `.env.prod` сам
  переходит в режим миграции, если рядом найдена старая витрина (кроме
  тег-деплоя из CI — там миграция должна быть явной: `--migrate`).
  **После миграции** обычные вызовы `update.sh` (вкл. Deploy workflow)
  автоматически обновляют Next-витрину. `migrate-to-next.sh` — compat-обёртка.
- `scripts/cleanup-old-ui.sh` — очистка старой витрины: контейнеры (compose
  down по проекту старого репо + label-фильтр), образы (`--images`, тег из
  `.deploy-state`; `--all-tags` — все), dangling-слои, билд-кеш. Не трогает
  сеть `shop` и чужие проекты. `--dry-run`.
- `docker-compose.prod.yml` переписан: PORT=80, без `ports:` (Caddy-only,
  как у sp-ui), серверные env (`API_BASE_URL`, `APP_URL`) — runtime;
  `docker-compose.publish.yml` — порт-override для прямого доступа.
- `.env.prod.example` с комментарием о «запечённых» NEXT_PUBLIC_*.

Синтаксис-проверки: `bash -n` всех 4 скриптов — OK; js-yaml для 2 compose +
3 workflows — OK. Docker-валидация compose (`docker compose config`) — на
сервере при первом деплое (локально docker отсутствует).

## Осталось (Ф6–Ф8 — на сервере, с живым бэкендом)

- [ ] Завести GitHub Variables (NEXT_PUBLIC_*) + Secrets (DEPLOY_*) в новом репо.
- [ ] Параллельная эксплуатация: `docker compose -f docker-compose.prod.yml -f
      docker-compose.publish.yml up -d` на тестовом порту; SEO-паритет curl'ом
      против SPA (OG/canonical/JSON-LD/product:price), скриншот-сравнение.
- [ ] Переключение: `./scripts/update.sh --migrate` (автовой встроен).
- [ ] Наблюдение 7 дней → `./scripts/cleanup-old-ui.sh --images` → архивация
      server-shop-sp-ui.

## SEO/перф-волна 2026-09-23 — SSR-контент, честный 404, dedup fetch (обе витрины)

Общий план и статус: `server-shop/docs/SEO-PERF-NEXT-PLAN-2026-09.md`.
Рецепт применён и к `server-shop-sp-next`, и к `server-shop-sale-next` (паритет
проверен статически: одинаковый набор страниц с `notFound`/`redirectTo`/SSR-пропсами).

- ✅ **P0.1 контент в SSR-HTML.** Новый `src/lib/server-data.ts` — серверные fetch
  **теми же** endpoint'ами, что клиентские хуки (`/products/{slug}`,
  `/products?page&per_page`, `/categories?tree=1`), дословный DTO→Product/Category
  маппинг и витринный фильтр `cfg-opt-*`. `ProductPage`/`CatalogPage`/`HomePage`
  принимают `initialProduct`/`initialProducts`/`initialCategories`, страницы
  `app/{page,catalog,catalog/[slug],product/[slug]}` их передают. Клиентские
  effect'ы сохранены (софт-переключение платформ, related, метрика), но не
  перезапрашивают уже отрендеренный slug.
- ✅ **P0.2 честный 404.** `fetchSeoDocumentServer` больше не сворачивает
  `kind=not_found` в `null`; `pageSeo` отдаёт `notFound: boolean` (+ noindex
  метаданные), тела product/catalog/[slug]/blog/[slug] зовут `notFound()`.
  Сбой API (`doc === null`) деградирует в фолбэк и НЕ даёт 404.
- ✅ **P0.3 dedup.** `cache()` на `/seo/document` и `/settings/site`: metadata и
  тело страницы делят один fetch для канонических URL. `/settings/site` —
  `force-cache` + `revalidate 60`; `/seo/document` — `no-store` (robots/redirects
  должны быть мгновенными).
- ✅ **P1.4** клиентский `usePageMeta` убран отовсюду, кроме `NotFoundPage`.
- ✅ Комментарии на китайском, оставленные подагентами, переписаны на русский.
- ✅ **P1.2 framer-motion убран из клиентского бандла (sp-next).** Библиотека
  импортировалась в 7 клиентских файлов, включая горячий путь (`ProductCard` на
  сетках каталога/главной, `layout/Header`, `layout/MegaMenu`, `ui/toast`), и
  попадала в бандл каждой страницы. Все анимации переведены на CSS:
  - `ProductCard` — hover-подъём `hover:-translate-y-1.5` + `transition-[transform,box-shadow]`;
  - `MegaMenu`/`CompareBar`/`toast` — классы `menu-in/out`, `bar-in/out`, `toast-in/out`
    (`src/index.css`), выход играет, пока элемент держит в DOM новый хук
    `src/hooks/usePresence.ts` (у тостов — свой список `leaving`);
  - `WhyStorySection` — прогресс-полоса и активный слайд на lg считаются одним
    rAF-слушателем скролла (ширина пишется прямо в DOM, без ре-рендера на пиксель),
    вход слайда — CSS-анимация по `key` с направлением из `dir`;
  - `NotFoundPage` — `pop-in`.
  Новые классы уважают `prefers-reduced-motion`. Проверка: `tsc --noEmit` — 0 ошибок,
  `next build` — «Compiled successfully», в свежих чанках `.next/static/chunks`
  (35 файлов) **0** совпадений по `framer-motion|data-projection-id|whileHover|AnimatePresence`.
  Пакет `framer-motion` оставлен в `package.json` (без импортов он не попадает в
  граф сборки; удаление зависимости требует регенерации lock-файла).
- ✅ **Наблюдаемость серверного слоя** (инцидент стенда 2026-09-23): `serverGet` в
  `src/lib/seo-server.ts` и `src/lib/server-data.ts` больше не глушит причину
  деградации — пишет `[seo-server]`/`[storefront-server] <path> → HTTP <status>` или
  `сбой запроса: …` в лог витрины (`docker logs`). В `seo-server` тело читается и на
  404/410: `SeoDocumentBuilder` может отдать документ (`kind`/`http_status`) таким
  статусом — это факт отсутствия (страница отдаёт `notFound()`), а не сбой API.
  `404` на `/products/{slug}` намеренно не логируется — штатное «нет товара».
  Разбор: `server-shop/docs/ai-agent/updates/2026-09-23-caddy-reload-after-frontend.md`.
- ✅ **P1.2 подтверждён на стенде замером** (2026-09-23): в живом CSS
  `580caccf83f6dc3d.css` есть `story-enter-*`, `toast-out`, `bar-out`, `menu-out`,
  `.pop-in`; в 18 JS-чанках — 0 совпадений по framer-motion. Главная: 905 КБ
  (840 КБ JS + 65 КБ CSS) против 1030 КБ (966 КБ JS в 20 чанках) → −126 КБ JS,
  −2 запроса (исчез чанк 118.7 КБ — framer-motion).
- ⏳ Осталось: **перечитать** Caddy на стенде (одной перегенерации файла мало) — на
  `new.server-price.ru` Googlebot получает 404 от Laravel, т.е. живой конфиг всё ещё
  содержит `@bot`-роут на удалённый `/seo/html`; тот же неперечитанный конфиг не
  применяет `@static_media` (медиа/шрифты отдаются с `max-age=0`). Молчащие пути
  деплоя исправлены в `server-shop/scripts`; P1.1 ISR, P1.5 шрифты; настоящий 410
  (сейчас 404+noindex).

