/**
 * Серверный слой контента (только Node-рантайм, без браузерных API).
 *
 * В SPA все view оставались клиентскими и тянули данные в useEffect —
 * SSR-HTML содержал метатеги, но НЕ содержал карточек/цен/H1. Здесь —
 * те же витринные endpoint'ы, что используют клиентские хуки (lib/api.ts),
 * но на сервере: force-dynamic страница дожидается ответа и отдаёт
 * готовый контент в initialData пропсы view.
 *
 * Маппинг DTO→Product/Category дублирован из lib/api.ts дословно:
 * lib/api.ts обращается к localStorage в request()/getAuthToken() и к
 * productImage() — модуль в целом не чистый, импортировать его с сервера
 * нельзя (урок из MEMORY: переносить выражения исходного кода дословно,
 * дословный дубликат лучше переизобретённого).
 *
 * Контракт: cache:"no-store", AbortSignal.timeout(4000), try/catch → null
 * (тот же, что в lib/seo-server.ts).
 */

import { API_BASE_SERVER } from "@/lib/api-base";
import { cache } from "react";
import { productImage } from "@/lib/placeholder";

export type { Product, Category, Subcategory } from "@/data/types";
import type { Product, Category, Subcategory } from "@/data/types";

/* ── Транспорт ─────────────────────────────────────────── */

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

async function serverGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE_SERVER}${path}`, {
      headers: {
        Accept: "application/json",
        // Сайт-контекст мультиинстанс-бэкенда (как X-Seo-Site в SPA-версии).
        ...(appUrlOrigin() ? { "X-Seo-Site": appUrlOrigin() } : {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // API недоступен (например, во время next build) — страница деградирует
    // к клиентской загрузке через initialData=null.
    return null;
  }
}

/* ── DTO (дословно из lib/api.ts) ──────────────────────── */

type ApiProduct = {
  id: string;
  sku?: string;
  slug: string;
  name: string;
  short_name?: string | null;
  short_description?: string | null;
  brand?: { id?: string; name?: string; slug?: string } | null;
  categories?: Array<{ id: string; name: string; slug: string }>;
  shipping_category_slugs?: string[];
  price?: {
    display?: number | null;
    compare_at_display?: number | null;
    on_sale?: boolean;
    is_on_request?: boolean;
  };
  price_configurator?: { display?: number | null; is_on_request?: boolean };
  is_configurable?: boolean;
  is_new?: boolean;
  filter_values?: Record<string, string[]>;
  is_ready_configuration?: boolean;
  configurator_edit?: {
    product_id: string;
    slug: string;
    name?: string;
    selections?: Array<{ slot_id: string; product_id: string; qty: number }>;
  } | null;
  composition?: Array<{ slot?: string; name?: string; qty?: number }>;
  status?: ProductStatus | null;
  status_configurator?: ConfiguratorStatus | null;
  /** Primary image URL from admin media (null if none) */
  image?: string | null;
  images?: string[] | null;
  media?: Array<{
    id: string;
    collection?: string;
    mime_type?: string;
    url?: string | null;
    urls?: Record<string, string | null | undefined>;
  }>;
  warranty?: {
    package_id?: string;
    name?: string;
    months?: number | null;
    label?: string;
  } | null;
  description?: string | null;
  attributes?: Array<{
    code?: string | null;
    name?: string | null;
    type?: string | null;
    value_text?: string | null;
    value_number?: string | null;
    value_boolean?: boolean | null;
    file?: {
      media_id?: string;
      name?: string;
      url?: string | null;
      mime_type?: string | null;
    } | null;
  }>;
};

type ApiCategory = {
  id: string;
  name: string;
  slug: string;
  parent_id?: string | null;
  description?: string | null;
  icon?: string | null;
  sort_order?: number;
  products_count?: number;
  count?: number;
  children?: ApiCategory[];
};

type ProductStatus = "draft" | "published" | "hidden" | "archived";
type ConfiguratorStatus = "disabled" | "available";

type ApiItem<T> = { data?: T | null; meta?: Record<string, number> };

/* ── Маппинг (дословно из lib/api.ts) ──────────────────── */

/** Media URLs from the API can be relative (/storage/...) — resolve against API origin. */
function absoluteMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith("data:")) return url;
  // Relative /storage/... from API host
  const origin = API_BASE_SERVER.replace(/\/api\/v1\/?$/, "") || "http://127.0.0.1:8080";
  return `${origin}${url.startsWith("/") ? url : `/${url}`}`;
}

function mediaImageItems(p: ApiProduct) {
  return (p.media || []).filter((m) => !m.mime_type || m.mime_type.startsWith("image/"));
}

/** Card/list: ~400px thumb. Gallery: full converted webp. */
function resolveProductImages(p: ApiProduct): { card: string | null; gallery: string[] } {
  const items = mediaImageItems(p);
  const galleryFromImages = (p.images || [])
    .map((u) => absoluteMediaUrl(u))
    .filter((u): u is string => Boolean(u));
  const galleryFromMedia = items
    .map((m) => absoluteMediaUrl(m.urls?.webp || m.urls?.original || m.url))
    .filter((u): u is string => Boolean(u));
  const gallery = galleryFromImages.length ? galleryFromImages : galleryFromMedia;

  const thumbs = items
    .map((m) => absoluteMediaUrl(m.urls?.thumb || m.urls?.webp || m.url))
    .filter((u): u is string => Boolean(u));
  const card = absoluteMediaUrl(p.image) || thumbs[0] || gallery[0] || null;

  return { card, gallery };
}

export function mapApiProduct(p: ApiProduct): Product {
  const display = p.price?.display ?? null;
  const compare = p.price?.compare_at_display ?? null;
  const brand = (p.brand?.name || "").trim();
  const categorySlugs = [...new Set([
    ...(p.categories || []).map((c) => c.slug).filter(Boolean),
    ...(p.shipping_category_slugs || []),
  ])];
  const category = categorySlugs[0] ?? "";
  const categoryTitle =
    (p.categories || []).map((c) => (c.name || "").trim()).find(Boolean) || "";
  const { card, gallery } = resolveProductImages(p);
  const placeholder = productImage(p.name, 200 + (p.name.length % 100));

  return {
    id: p.id,
    slug: p.slug || p.sku || p.id,
    title: p.name,
    brand,
    category,
    categoryTitle,
    categorySlugs,
    image: card || placeholder,
    images: gallery.length ? gallery : undefined,
    price: display == null ? null : Number(display),
    oldPrice: compare != null && display != null && compare > display ? Number(compare) : null,
    onRequest: p.price?.is_on_request === true || display === null,
    status: p.status ?? null,
    configuratorStatus: p.status_configurator ?? null,
    condition: p.is_new ? "new" : "used",
    badges: p.price?.on_sale ? ["Скидка"] : p.is_configurable ? ["Конфигуратор"] : undefined,
    specs: (() => {
      const fromAttrs = (p.attributes || [])
        .filter((a) => a.type !== "file" && a.type !== "product")
        .map((a) => {
          const value =
            a.value_text ||
            a.value_number ||
            (a.value_boolean == null ? "" : a.value_boolean ? "Да" : "Нет");
          return { label: a.name || a.code || "Атрибут", value: String(value) };
        })
        .filter((s) => s.value);
      if (fromAttrs.length) return fromAttrs;
      if (p.short_description) return [{ label: "Описание", value: p.short_description }];
      return p.sku ? [{ label: "Артикул", value: p.sku }] : [];
    })(),
    description: p.description ?? p.short_description ?? undefined,
    documents: (p.attributes || [])
      .filter((a) => a.type === "file" && a.file?.url)
      .map((a) => ({
        name: a.file?.name || a.name || "Документ",
        url: absoluteMediaUrl(a.file?.url) || "",
      }))
      .filter((d) => d.url),
    isConfigurable: Boolean(p.is_configurable),
    isReadyConfiguration: Boolean(p.is_ready_configuration),
    configuratorEdit: p.configurator_edit?.slug
      ? {
          productId: p.configurator_edit.product_id,
          slug: p.configurator_edit.slug,
          name: p.configurator_edit.name,
          selections: (p.configurator_edit.selections || []).map((s) => ({
            slot_id: s.slot_id,
            product_id: s.product_id,
            qty: s.qty || 1,
          })),
        }
      : null,
    composition: (p.composition || [])
      .filter((row) => (row.name || "").trim())
      .map((row) => ({
        slot: (row.slot || "Комплектующая").trim(),
        name: (row.name || "").trim(),
        qty: Math.max(1, Number(row.qty) || 1),
      })),
    sku: p.sku,
    filterValues: p.filter_values ?? {},
    shortName: p.short_name ?? undefined,
    shortDescription: p.short_description ?? undefined,
    warranty: p.warranty?.package_id
      ? {
          packageId: p.warranty.package_id,
          name: p.warranty.name || p.warranty.label || "Гарантия",
          months: p.warranty.months ?? null,
          label:
            p.warranty.label ||
            p.warranty.name ||
            (p.warranty.months
              ? `Гарантия ${p.warranty.months} мес.`
              : "Гарантия"),
        }
      : null,
  };
}

export function mapApiCategory(c: ApiCategory): Category {
  return {
    id: c.id,
    slug: c.slug,
    title: c.name,
    icon: c.icon || "Box",
    count: Number(c.products_count ?? c.count ?? 0) || 0,
    description: c.description ?? undefined,
    parentId: c.parent_id ?? null,
    children: (c.children || []).map((ch) => {
      const nested = mapApiCategory(ch);
      return {
        id: nested.id,
        slug: nested.slug,
        title: nested.title,
        count: nested.count,
        parentId: nested.parentId,
        children: nested.children,
      } as Subcategory;
    }),
  };
}

/* ── Витринные фетчи (те же endpoint'ы, что в lib/api.ts) ─ */

/**
 * Тот же endpoint, что fetchProduct(idOrSlug) в lib/api.ts:
 * GET /products/{slug} → маппинг DTO→Product идентичный.
 * not_found/ошибка → null (страница отдаёт notFound()).
 */
export async function fetchProductServer(
  slug: string,
): Promise<Product | null> {
  let key = String(slug || "").trim();
  try {
    key = decodeURIComponent(key);
  } catch {
    /* already decoded */
  }
  if (!key) return null;
  const res = await serverGet<ApiItem<ApiProduct>>(
    `/products/${encodeURIComponent(key)}`,
  );
  const raw = res?.data;
  return raw ? mapApiProduct(raw) : null;
}

/**
 * Тот же endpoint/shape, что fetchProducts(page, per_page) в lib/api.ts:
 * GET /products?page&per_page → { items, total, page, lastPage }.
 */
export async function fetchProductsServer(
  page = 1,
  perPage = 12,
): Promise<{ items: Product[]; total: number; page: number; lastPage: number } | null> {
  const qs = new URLSearchParams();
  qs.set("per_page", String(perPage));
  if (page) qs.set("page", String(page));
  const res = await serverGet<ApiItem<ApiProduct[]>>(`/products?${qs}`);
  if (res == null) return null;
  const raw = res.data || [];
  const items = raw.map(mapApiProduct);
  const meta = res.meta || {};
  return {
    items,
    total: Number(meta.total ?? items.length),
    page: Number(meta.current_page ?? 1),
    lastPage: Number(meta.last_page ?? 1),
  };
}

/**
 * Категории деревом — тот же endpoint, что fetchCategories(tree) /
 * useCategories в lib/api.ts: GET /categories?tree=1.
 */
export async function fetchCategoriesServer(): Promise<Category[] | null> {
  const res = await serverGet<ApiItem<ApiCategory[]>>(`/categories?tree=1`);
  const raw = res?.data;
  return raw ? raw.map(mapApiCategory) : null;
}

/* ── Кэш по месту использования (per-request, как React cache) ── */

/** Dedup внутри одного запроса: generateMetadata + тело страницы. */
export const fetchProductCached = cache(fetchProductServer);
export const fetchProductsCached = cache(fetchProductsServer);
export const fetchCategoriesCached = cache(fetchCategoriesServer);

/**
 * Витринный каталог: hide zero-price builtin options unless platform.
 * Урок из MEMORY: фильтр перенесён ДОСЛОВНО из useCatalogProducts.ts.
 */
export function applyCatalogFilter(products: Product[]): Product[] {
  return products.filter(
    (p) =>
      !p.slug.startsWith("cfg-opt-") ||
      (p.price != null && p.price > 0) ||
      p.onRequest ||
      p.slug.startsWith("cfg-platform-"),
  );
}

/**
 * Серверная сборка страницы каталога: товары (первая страница, 12 шт —
 * тот же PAGE_SIZE, что клиентский CatalogPage) + категории деревом.
 * Обе ошибки → null-поля (API-сбой не превращаем в 404 каталога).
 */
export async function fetchCatalogPageServer(): Promise<{
  products: Product[] | null;
  categories: Category[] | null;
}> {
  const [products, categories] = await Promise.all([
    fetchProductsCached(1, 12),
    fetchCategoriesCached(),
  ]);
  return {
    products: products ? applyCatalogFilter(products.items) : null,
    categories,
  };
}