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
import {
  fetchSeoDocumentServer,
  fetchSiteServer,
  formatPageTitleServer,
  toLocalPath,
  type ServerSeoDocument,
} from "./seo-server";

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
  meta.openGraph = {
    type: (doc.og_type as "website" | "article" | undefined) || "website",
    siteName: doc.brand || site?.brand || undefined,
    title: ogTitle,
    description: ogDescription,
    url: doc.canonical || undefined,
    ...(doc.image
      ? { images: [{ url: doc.image, alt: doc.image_alt || undefined }] }
      : {}),
  };

  meta.twitter = {
    card: doc.image ? "summary_large_image" : "summary",
    title: ogTitle,
    description: ogDescription,
    ...(doc.image ? { images: [doc.image] } : {}),
  };

  // product:price:* — применяется теми же ключами, что в applyDocument SPA.
  const other: Record<string, string> = {};
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
};

export async function pageSeo(
  path: string,
  pathnameForFallback?: string,
): Promise<PageSeoResult> {
  const [doc, site] = await Promise.all([
    fetchSeoDocumentServer(path),
    fetchSiteServer(),
  ]);

  // Легаси-редиректы (смена slug, /catalog?category=): человек и бот
  // уходят на канонический адрес постоянным редиректом (выполняет страница).
  let redirectTo: string | null = null;
  if (doc?.redirect_to) {
    const target = toLocalPath(doc.redirect_to);
    if (target && target !== path) {
      redirectTo = target;
    }
  }

  if (doc) {
    return {
      metadata: seoDocToMetadata(doc, site),
      jsonld: Array.isArray(doc.jsonld) ? doc.jsonld : [],
      redirectTo,
    };
  }

  return {
    metadata: fallbackMetadata(pathnameForFallback || path, site),
    jsonld: [],
    redirectTo,
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
