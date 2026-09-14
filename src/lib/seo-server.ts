/**
 * Серверный SEO-слой (только Node-рантайм, без браузерных API).
 *
 * В SPA DocumentHead.tsx тянул /seo/document на клиенте и применял метатеги
 * в рантайме; в Next.js то же самое делает generateMetadata на сервере —
 * краулер и соцсети получают готовые теги в HTML без JS.
 *
 * Контракт: server-shop/docs/STOREFRONT-API.md (SeoDocument, SeoDocumentBuilder).
 * Здесь дублируется ровно та семантика fetchSeoDocument/fetchSite из
 * src/lib/api.ts, которая нужна для метаданных — без localStorage/токенов.
 */

import { cache } from "react";

import { API_BASE_SERVER } from "@/lib/api-base";

export type ServerSeoDocument = {
  kind: string;
  http_status: number;
  robots: string;
  canonical: string;
  title: string;
  description: string;
  h1: string;
  image: string | null;
  og_type?: string;
  brand?: string | null;
  image_alt?: string | null;
  price_amount?: string | null;
  price_currency?: string | null;
  specs?: Array<{ name: string; value: string }> | null;
  jsonld?: unknown[];
  redirect_to?: string | null;
};

export type ServerSite = {
  title: string;
  titleSuffix: string;
  description: string;
  brand: string;
  logoUrl: string | null;
  ogImageUrl: string | null;
};

type ApiItem<T> = { data?: T | null };

const FETCH_TIMEOUT_MS = 4000;

function appUrlOrigin(): string {
  const raw = (process.env.APP_URL || "").replace(/\/$/, "");
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
}

type ServerGetOptions = {
  /** no-store (дефолт) или force-cache для стабильных данных (site). */
  cache?: "no-store" | "force-cache";
  revalidate?: number;
};

async function serverGet<T>(path: string, options: ServerGetOptions = {}): Promise<T | null> {
  const { cache, revalidate } = options;
  try {
    const res = await fetch(`${API_BASE_SERVER}${path}`, {
      headers: {
        Accept: "application/json",
        // Сайт-контекст мультиинстанс-бэкенда (как X-Seo-Site в SPA-версии).
        ...(appUrlOrigin() ? { "X-Seo-Site": appUrlOrigin() } : {}),
      },
      // Дефолт no-store (robots/redirects мгновенные); /settings/site —
      // force-cache с revalidate (данные меняются редко).
      cache: cache ?? "no-store",
      ...(cache === "force-cache" && revalidate != null
        ? { next: { revalidate } }
        : {}),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // API недоступен (например, во время next build) — метаданные деградируют
    // до фолбэков, страница остаётся рабочей.
    return null;
  }
}

/**
 * Тот же контракт, что fetchSeoDocument в lib/api.ts, но not_found НЕ
 * сворачивается в null: SeoDocumentBuilder отвечает документом kind=not_found
 * на несуществующий путь — это ФАКТ ОТСУТСТВИЯ (страница отдаёт notFound()),
 * а null здесь — только сбой/недоступность API (страница деградирует в фолбэк,
 * не подменяя адрес 404-м: не путаем сбой витринного API с ошибкой URL).
 * Редиректы возвращаются как redirect_to (P0.2/P0.4).
 */
export async function fetchSeoDocumentServer(
  path: string,
): Promise<ServerSeoDocument | null> {
  const qs = new URLSearchParams({ path });
  return serverGet<ApiItem<ServerSeoDocument>>(
    `/seo/document?${qs.toString()}`,
  ).then((res) => res?.data ?? null);
}

type ApiSitePayload = {
  title?: string | null;
  title_suffix?: string | null;
  description?: string | null;
  brand?: string | null;
  logo_url?: string | null;
  og_image_url?: string | null;
};

function absoluteMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith("data:")) return url;
  const origin = API_BASE_SERVER.replace(/\/api\/v1\/?$/, "") || "http://127.0.0.1:8080";
  return `${origin}${url.startsWith("/") ? url : `/${url}`}`;
}

export async function fetchSiteServer(): Promise<ServerSite | null> {
  // /settings/site меняется редко — кросс-запросный кэш (revalidate 60 c);
  // в отличие от /seo/document, где robots/redirects должны быть мгновенными.
  const res = await serverGet<ApiItem<ApiSitePayload>>("/settings/site", {
    cache: "force-cache",
    revalidate: 60,
  });
  const raw = res?.data;
  if (!raw) return null;
  const title = String(raw.title || "").trim();
  const brand = String(raw.brand || title).trim();
  return {
    title,
    titleSuffix: String(raw.title_suffix || "").trim(),
    description: String(raw.description || "").trim(),
    brand,
    logoUrl: absoluteMediaUrl(raw.logo_url || null),
    ogImageUrl: absoluteMediaUrl(raw.og_image_url || null),
  };
}

/** formatPageTitle из lib/api.ts (дублировано, чтобы не тянуть клиентский модуль). */
export function formatPageTitleServer(
  page: string | null | undefined,
  site: ServerSite | null,
): string {
  const home = (site?.title || site?.brand || "").trim();
  const suffix = (site?.titleSuffix || site?.brand || site?.title || "").trim();
  const pageTitle = (page || "").trim();
  if (!pageTitle) return home;
  if (!suffix || pageTitle === home || pageTitle.includes(suffix)) return pageTitle;
  return `${pageTitle} — ${suffix}`;
}

/** Абсолютный (skin origin) или локальный redirect target → локальный путь. */
export function toLocalPath(redirectTo: string): string {
  try {
    if (/^https?:\/\//i.test(redirectTo)) {
      const url = new URL(redirectTo);
      return url.pathname + url.search;
    }
    return redirectTo.startsWith("/") ? redirectTo : `/${redirectTo}`;
  } catch {
    return "";
  }
}
