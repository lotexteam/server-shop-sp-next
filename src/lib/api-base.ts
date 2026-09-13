/**
 * База Storefront API.
 *
 * В SPA-версии читалось import.meta.env.VITE_API_BASE_URL; в Next.js
 * NEXT_PUBLIC_* вшивается в клиентский бандл на этапе build, а серверная
 * копия (без префикса NEXT_PUBLIC_) доступна только серверу — её используют
 * generateMetadata и серверные fetch (см. lib/seo-server.ts).
 */

const DEFAULT_API_BASE = "http://127.0.0.1:8080/api/v1";

function normalize(raw: string | undefined): string | null {
  const v = (raw as string | undefined)?.replace(/\/$/, "");
  return v || null;
}

/** Клиентская база (и фолбэк для сервера). */
export const API_BASE =
  normalize(process.env.NEXT_PUBLIC_API_BASE_URL) ??
  normalize(process.env.API_BASE_URL) ??
  DEFAULT_API_BASE;

/** Серверная база — приоритет у приватной переменной, если задана. */
export const API_BASE_SERVER =
  normalize(process.env.API_BASE_URL) ?? API_BASE;

/** Origin хранилища картинок (preconnect hint). Пусто = не отдавать hint. */
export const MEDIA_BASE_URL =
  normalize(process.env.NEXT_PUBLIC_MEDIA_BASE_URL) ?? "";
