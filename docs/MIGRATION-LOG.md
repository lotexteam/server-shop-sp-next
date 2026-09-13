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

## Осталось (Ф6–Ф8 — на сервере, с живым бэкендом)

- [ ] CI: GHCR publish + update.sh (по образцу sp-ui workflow).
- [ ] Параллельная эксплуатация на тестовом порту/поддомене, SEO-паритет
      curl'ом против SPA (OG/canonical/JSON-LD/product:price), скриншот-
      сравнение по ~30 URL.
- [ ] Переключение алиаса в Caddy (STOREFRONT_ALIAS), наблюдение 7 дней.
- [ ] Архивация server-shop-sp-ui.
