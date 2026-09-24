import type { NextConfig } from "next";
import path from "node:path";

/**
 * server-shop-sp-next — Next.js 16 App Router версия витрины server-shop-sp-ui.
 * Дизайн перенесён 1:1 из Vite/React SPA (см. docs/MIGRATION-PLAN.md).
 */
const nextConfig: NextConfig = {
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
  },
  // Компактный Node-контейнер: docker copy .next/standalone + static + public.
  output: "standalone",
  images: {
    // Все изображения — обычные <img> как в SPA-версии (картинки лежат на
    // медиа-хранилище с другим origin); next/image оптимизацию не включаем,
    // чтобы не менять разметку и сетевые запросы (дизайн/поведение 1:1).
    unoptimized: true,
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
};

export default nextConfig;
