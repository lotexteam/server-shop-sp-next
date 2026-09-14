/**
 * Серверный helper для generateMetadata страниц (фаза Ф3).
 *
 * Повторяет семантику клиентского DocumentHead из SPA:
 *  - /seo/document — источник истины для title/description/robots/OG/
 *    canonical/JSON-LD (тот же контракт, что бот-HTML SeoDocumentBuilder);
 *  - redirect_to → страница вызывает redirect()/permanentRedirect() в теле
 *    (НЕ из generateMetadata — redirect-функции там не поддерживаются);
 *  - фолбэки по пути (titleFromPath) + site-тайтл с суффиксом.
 */

import type { Metadata } from "next";
import { cache } from "react";
import {
  fetchSeoDocumentServer,
  fetchSiteServer,
  formatPageTitleServer,
  toLocalPath,
  type ServerSeoDocument,
} from "./seo-server";

// Dedup запросов /seo/document и /settings/site: pageSeo вызывается и из
// generateMetadata, и из тела страницы — кэш React отдаёт один результат
// на запрос (один fetch вместо двух). Кэш per-request, между запросами не живёт.
const fetchSeoDocumentCached = cache(fetchSeoDocumentServer);
const fetchSiteCached = cache(fetchSiteServer);

/** titleFromPath из DocumentHead SPA (sp-ui набор). */
const PATH_TITLES: Array<[string, string]> = [
  ["/catalog", "Каталог"],
  ["/checkout", "Оформление заказа"],
  ["/contacts", "Контакты"],
  ["/blog/about", "О компании"],
  ["/blog", "Блог"],
  ["/account", "Личный кабинет"],
  ["/configurator", "Конфигуратор"],
  ["/build/", "Сборка"],
];

function fallbackTitle(pathname: string): string | null {
  if (pathname === "/") return null;
  // Точный префиксный матч по порядку (более специфичные первыми).
  for (const [prefix, title] of PATH_TITLES) {
    if (pathname.startsWith(prefix)) return title;
  }
  return null;
}

function seoDocToMetadata(
  doc: ServerSeoDocument,
  site: Awaited<ReturnType<typeof fetchSiteServer>>,
): Metadata {
  const meta: Metadata = {
    // SeoDocumentBuilder возвращает ПОЛНЫЙ тайтл (с суффиксом сайта) —
    // absolute отключает template-суффикс из корневого layout.
    ...(doc.title
      ? { title: { absolute: doc.title } }
      : {}),
    description: doc.description || undefined,
  };

  if (doc.robots) meta.robots = doc.robots;
  if (doc.canonical) {
    meta.alternates = { canonical: doc.canonical };
  }

  const ogTitle = doc.title || undefined;
  const ogDescription = doc.description || undefined;
  // Next 16 валидирует openGraph.type и падает на значении вне whitelist
  // ('Invalid OpenGraph type: product' — инцидент «Ошибка рендеринга» на
  // страницах конфигураторов, og_type=product из SeoDocumentBuilder).
  // Разрешённые: website | article | book | profile | music.* | video.*.
  const OG_ALLOWED = new Set([
    "website", "article", "book", "profile",
    "music.song", "music.album", "music.playlist", "music.radio_station",
    "video.movie", "video.episode", "video.tv_show", "video.other",
  ]);
  const ogTypeRaw = (doc.og_type || "website").trim();
  const ogType = OG_ALLOWED.has(ogTypeRaw) ? ogTypeRaw : "website";
  meta.openGraph = {
    type: ogType as "website" | "article",
    siteName: doc.brand || site?.brand || undefined,
    title: ogTitle,
    description: ogDescription,
    url: doc.canonical || undefined,
    ...(doc.image
      ? { images: [{ url: doc.image, alt: doc.image_alt || undefined }] }
      : {}),
  };
  // Нестандартный og:type (например, product) отдаём прямым метатегом в
  // other — соцсети читают его, валидатор Next не видит. Прямой тег
  // дублирует сгенерированный из whitelist — оставляем только «честный».
  const other: Record<string, string> = {};
  if (ogTypeRaw !== ogType) {
    other["og:type"] = ogTypeRaw;
  }

  meta.twitter = {
    card: doc.image ? "summary_large_image" : "summary",
    title: ogTitle,
    description: ogDescription,
    ...(doc.image ? { images: [doc.image] } : {}),
  };

  // product:price:* — применяется теми же ключами, что в applyDocument SPA.
  if (doc.price_amount && doc.price_currency) {
    other["product:price:amount"] = doc.price_amount;
    other["product:price:currency"] = doc.price_currency;
  }
  if (Object.keys(other).length) meta.other = other;

  return meta;
}

function fallbackMetadata(
  pathname: string,
  site: Awaited<ReturnType<typeof fetchSiteServer>>,
): Metadata {
  const page = fallbackTitle(pathname);
  const title = formatPageTitleServer(page, site);
  return {
    // title может быть пустым (нет site и нет фолбэка) — останется default
    // из корневого layout.
    ...(title ? { title: { absolute: title } } : {}),
    ...(site?.description ? { description: site.description } : {}),
  };
}

/** Метаданные страницы-404: фолбэк-тайтл + noindex/nofollow (статус даёт notFound()). */
function notFoundMetadata(
  pathname: string,
  site: Awaited<ReturnType<typeof fetchSiteServer>>,
): Metadata {
  return {
    ...fallbackMetadata(pathname, site),
    robots: { index: false, follow: false },
  };
}

export type PageSeoResult = {
  metadata: Metadata;
  /** JSON-LD блоки SeoDocument — рендерятся страницей в SSR-HTML. */
  jsonld: unknown[];
  /**
   * Легаси-редирект из SeoDocument (смена slug и т.п.). Возвращает цель
   * вместо того, чтобы бросать permanentRedirect прямо здесь: redirect из
   * generateMetadata в Next 16 не поддерживается и роняет рендер
   * (инцидент «Ошибка рендеринга» на /product?edit=…). Страница сама
   * вызывает redirect()/permanentRedirect() в своём теле.
   */
  redirectTo: string | null;
  /**
   * SeoDocumentBuilder ответил kind=not_found — это ФАКТ отсутствия сущности
   * (нет товара/категории/статьи): страница обязана отдать HTTP 404 через
   * notFound(), а не мягкий 200 с фолбэк-метаданными. null-документ (сбой
   * витринного API) сюда НЕ попадает — там notFound=false, страница деградирует
   * в фолбэк и остаётся рабочей.
   */
  notFound: boolean;
};

export async function pageSeo(
  path: string,
  pathnameForFallback?: string,
): Promise<PageSeoResult> {
  const [doc, site] = await Promise.all([
    fetchSeoDocumentCached(path),
    fetchSiteCached(),
  ]);
  const notFound = doc?.kind === "not_found";

  // Легаси-редиректы (смена slug, /catalog?category=): человек и бот
  // уходят на канонический адрес постоянным редиректом (выполняет страница).
  let redirectTo: string | null = null;
  if (doc?.redirect_to) {
    const target = toLocalPath(doc.redirect_to);
    if (target && target !== path) {
      redirectTo = target;
    }
  }

  if (doc && !notFound) {
    return {
      metadata: seoDocToMetadata(doc, site),
      jsonld: Array.isArray(doc.jsonld) ? doc.jsonld : [],
      redirectTo,
      notFound: false,
    };
  }

  if (notFound) {
    // Факт отсутствия: страница вызовет notFound() → настоящий HTTP 404.
    // redirect_to (если бэкенд отдал его вместе с not_found) приоритетнее:
    // страница проверяет redirectTo раньше notFound.
    return {
      metadata: notFoundMetadata(pathnameForFallback || path, site),
      jsonld: [],
      redirectTo,
      notFound: true,
    };
  }

  return {
    metadata: fallbackMetadata(pathnameForFallback || path, site),
    jsonld: [],
    redirectTo,
    notFound: false,
  };
}

/** Рендер JSON-LD блоков SeoDocument (server component helper). */
export function JsonLd({ blocks }: { blocks: unknown[] }) {
  if (!blocks?.length) return null;
  return (
    <>
      {blocks.map((block, i) => (
        <script
          key={`seo-jsonld-${i}`}
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}
    </>
  );
}
