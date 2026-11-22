import type { NextConfig } from "next";
import path from "node:path";
// Заголовки безопасности живут в src/lib/security-headers.ts: тот же список
// применяет middleware для собственных ответов (404/редиректы).
import { SECURITY_HEADERS } from "./src/lib/security-headers";

/**
 * server-shop-sp-next — Next.js 16 App Router версия витрины server-shop-sp-ui.
 * Дизайн перенесён 1:1 из Vite/React SPA (см. docs/MIGRATION-PLAN.md).
 */
const nextConfig: NextConfig = {
  // Next 16 по умолчанию СТРИМИТ метаданные: для обычных User-Agent'ов
  // <title>, <meta>, <link rel="canonical"> доезжают в HTML уже в <body>
  // (head к тому моменту сброшен), и поисковики/аудиторы их не видят.
  // Пустой «жадный» регэксп переводит ВСЕ запросы на блокирующий режим —
  // метаданные резолвятся до первого байта и попадают в <head>.
  // (SEO-аудит store-server.ru 2026-11-20: core-canonical-outside-head,
  // content-meta-in-body, htmlval-title-outside-head.)
  htmlLimitedBots: /.*/,
  // security-info-disclosure: X-Powered-By: Next.js выдавал стек.
  poweredByHeader: false,
  compress: false,
  // Turbopack: корень проекта — этот каталог (иначе Next берёт каталог
  // первого найденного lockfile выше по дереву).
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Dev-сервер доступен и по 127.0.0.1, и по localhost (с портом).
  allowedDevOrigins: ["http://127.0.0.1:3100", "http://localhost:3100"],
  // Single-domain деплой: на одном хосте с admin-ui (тоже Next.js) путь
  // /_next/* принадлежит админке (Caddyfile). Префикс /shop-next выносит
  // статику витрины из-под конфликта; генерируется соответствующий маршрут
  // в Caddy (server-shop scripts/lib-caddy.sh). В multi-domain не задавайте.
  ...(process.env.NEXT_ASSET_PREFIX
    ? { assetPrefix: process.env.NEXT_ASSET_PREFIX }
    : {}),
  // NEXT_ASSET_PREFIX — серверная переменная; клиенту (воркер MapLibre в
  // ContactsMapLibre) нужна публичная копия, иначе URL воркера уйдёт без
  // префикса и попадёт не в ту статику.
  env: {
    NEXT_PUBLIC_ASSET_PREFIX: process.env.NEXT_ASSET_PREFIX ?? "",
    // Канонический origin для share-ссылок и клиентских абсолютных URL.
    NEXT_PUBLIC_SITE_URL: (process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, ""),
  },
  // Компактный Node-контейнер: docker copy .next/standalone + static + public.
  output: "standalone",
  images: {
    // Все изображения — обычные <img> как в SPA-версии (картинки лежат на
    // медиа-хранилище с другим origin); next/image оптимизацию не включаем,
    // чтобы не менять разметку и сетевые запросы (дизайн/поведение 1:1).
    unoptimized: true,
  },
  async headers() {
    return [
      // Заголовки безопасности на все ответы витрины (аудит 2026-11-20:
      // security-hsts / ssl-protocol / x-frame-options / x-content-type-options
      // / security-csp / security-coop / referrer-policy / permissions-policy).
      { source: "/:path*", headers: SECURITY_HEADERS },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Content-Type", value: "application/manifest+json; charset=utf-8" }],
      },
    ];
  },
  // Легаси-редиректы, которые в SPA были <Navigate replace>. Здесь они
  // настоящие HTTP 301 — SEO-семантика SeoDocumentBuilder (P0.2/P0.4)
  // сохраняется без клиентского JS.
  async redirects() {
    return [
      { source: "/cart", destination: "/checkout", permanent: true },
      { source: "/about", destination: "/blog/about", permanent: true },
      { source: "/faq", destination: "/blog/faq", permanent: true },
      { source: "/delivery", destination: "/blog/delivery", permanent: true },
      { source: "/warranty", destination: "/blog/warranty", permanent: true },
      { source: "/tradein", destination: "/blog/tradein", permanent: true },
      { source: "/services", destination: "/blog/services", permanent: true },
      { source: "/monitoring", destination: "/blog/monitoring", permanent: true },
      { source: "/konfigurator", destination: "/configurator", permanent: true },
    ];
  },
  // SEO: rewrite file-like URLs to Next.js routes
  // Next.js doesn't handle route directories with file extensions properly,
  // so we use rewrites to map the public URLs to internal route names.
  async rewrites() {
    return [
      { source: "/llms.txt", destination: "/llms-txt" },
      { source: "/ai-catalog.json", destination: "/ai-catalog-json" },
      // AI/GEO readiness (geo-agents-md, geo-markdown-response,
      // geo-well-known): файлы отдаются как text/markdown и application/json,
      // а не HTML-фолбэком сайта.
      { source: "/AGENTS.md", destination: "/agents-md" },
      { source: "/index.md", destination: "/index-md" },
      { source: "/.well-known/mcp.json", destination: "/.well-known/mcp-json" },
      { source: "/.well-known/agent-card.json", destination: "/.well-known/agent-card-json" },
      { source: "/.well-known/security.txt", destination: "/.well-known/security-txt" },
      { source: "/.well-known/gpc.json", destination: "/.well-known/gpc-json" },
      { source: "/.well-known/ai-plugin.json", destination: "/.well-known/ai-plugin-json" },
      { source: "/.well-known/ai-catalog.json", destination: "/.well-known/ai-catalog-json" },
      // ARD manifest alias (Lighthouse agentic-browsing checks /.well-known/ard.json)
      { source: "/.well-known/ard.json", destination: "/.well-known/ai-catalog-json" },
    ];
  },
};

export default nextConfig;
