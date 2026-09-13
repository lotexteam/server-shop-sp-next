/**
 * Storefront API client (Laravel /api/v1).
 * Single entry for catalog / checkout — no mock catalog data in pages.
 */

import type { Article, Category, Product } from "@/data/types";
import type { ConfiguratorStatus, ProductStatus } from "@/data/types";
import type { CartLine } from "@/store/shop";
import { productImage } from "@/lib/placeholder";
import { API_BASE } from "@/lib/api-base";

const TOKEN_KEY = "server-price-api-token";
const CART_TOKEN_KEY = "server-price-cart-token";

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function getCartToken(): string | null {
  try {
    return localStorage.getItem(CART_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setCartToken(token: string | null) {
  try {
    if (token) localStorage.setItem(CART_TOKEN_KEY, token);
    else localStorage.removeItem(CART_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export class StorefrontApiError extends Error {
  status: number;
  code?: string;
  errors?: Record<string, string[]>;

  constructor(
    message: string,
    status: number,
    payload?: { code?: string; errors?: Record<string, string[]> },
  ) {
    super(message);
    this.name = "StorefrontApiError";
    this.status = status;
    this.code = payload?.code;
    this.errors = payload?.errors;
  }
}

export type ApiItem<T> = { data: T; meta?: Record<string, number> };

async function request<T>(
  path: string,
  init: RequestInit & { json?: unknown; auth?: boolean } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
    headers.set("Accept", "application/json");
  } else if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const token = getAuthToken();
  if (token && init.auth !== false && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const cartToken = getCartToken();
  if (cartToken && !headers.has("X-Cart-Token")) {
    headers.set("X-Cart-Token", cartToken);
  }

  const res = await fetch(`${API_BASE}${path.startsWith("/") ? path : `/${path}`}`, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text.slice(0, 200) };
  }

  if (!res.ok) {
    const payload = (data && typeof data === "object" ? data : {}) as {
      message?: string;
      code?: string;
      errors?: Record<string, string[]>;
    };
    throw new StorefrontApiError(
      payload.message || `Ошибка API (${res.status})`,
      res.status,
      { code: payload.code, errors: payload.errors },
    );
  }

  return data as T;
}

/* ── API DTOs ─────────────────────────────────────────── */

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

/* ── Mappers ──────────────────────────────────────────── */

/** Media URLs from the API can be relative (/storage/...) — resolve against API origin. */
export function absoluteMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith("data:")) return url;
  // Relative /storage/... from API host
  const origin = API_BASE.replace(/\/api\/v1\/?$/, "") || "http://127.0.0.1:8080";
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

/** Single-segment storefront path. Prefer slug; SKU/id still resolve on the API. */
export function productPath(p: { slug?: string | null; sku?: string | null; id: string }): string {
  const key = String(p.slug || p.sku || p.id).trim();
  return `/product/${encodeURIComponent(key)}`;
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
      };
    }),
  };
}

/* ── Catalog ──────────────────────────────────────────── */

/** Поиск через серверный эндпоинт (порядок релевантности бэка). */
export async function searchProductsApi(q: string): Promise<Product[]> {
  const res = await request<ApiItem<ApiProduct[]>>(`/search?q=${encodeURIComponent(q)}`);
  return (res.data || []).map(mapApiProduct);
}

export async function fetchProducts(params?: {
  page?: number;
  per_page?: number;
  q?: string;
  category_id?: string;
  category_ids?: string[];
  brand_id?: string;
  brand_ids?: string[];
  is_new?: boolean;
  on_sale?: boolean;
  attr?: Record<string, string[]>;
  attr_ranges?: Record<string, { min?: number; max?: number }>;
  sort?: "price-asc" | "price-desc";
}): Promise<{ items: Product[]; total: number; page: number; lastPage: number }> {
  const qs = new URLSearchParams();
  qs.set("per_page", String(params?.per_page ?? 250));
  if (params?.page) qs.set("page", String(params.page));
  if (params?.q) qs.set("q", params.q);
  const catIds = [
    ...(params?.category_id ? [params.category_id] : []),
    ...(params?.category_ids ?? []),
  ];
  for (const id of catIds) qs.append("filter[category_id][]", id);
  const brandIds = [
    ...(params?.brand_id ? [params.brand_id] : []),
    ...(params?.brand_ids ?? []),
  ];
  for (const id of brandIds) qs.append("filter[brand_id][]", id);
  if (params?.is_new != null) qs.set("filter[is_new]", params.is_new ? "1" : "0");
  if (params?.on_sale) qs.set("filter[on_sale]", "1");
  if (params?.sort) qs.set("sort", params.sort);
  if (params?.attr) {
    for (const [code, vals] of Object.entries(params.attr)) {
      for (const v of vals) qs.append(`filter[attr][${code}][]`, v);
    }
  }
  if (params?.attr_ranges) {
    for (const [code, range] of Object.entries(params.attr_ranges)) {
      if (range.min != null) qs.set(`filter[attr][${code}][min]`, String(range.min));
      if (range.max != null) qs.set(`filter[attr][${code}][max]`, String(range.max));
    }
  }

  const res = await request<ApiItem<ApiProduct[]>>(`/products?${qs}`);
  const items = (res.data || []).map(mapApiProduct);
  const meta = res.meta || {};
  return {
    items,
    total: Number(meta.total ?? items.length),
    page: Number(meta.current_page ?? 1),
    lastPage: Number(meta.last_page ?? 1),
  };
}

export async function fetchProduct(idOrSlug: string): Promise<Product | null> {
  let key = String(idOrSlug || "").trim();
  try {
    key = decodeURIComponent(key);
  } catch {
    /* already decoded */
  }
  if (!key) return null;
  try {
    const res = await request<ApiItem<ApiProduct>>(`/products/${encodeURIComponent(key)}`);
    return res.data ? mapApiProduct(res.data) : null;
  } catch {
    try {
      const { items } = await fetchProducts({ q: key, per_page: 50 });
      return (
        items.find(
          (p) =>
            p.slug === key ||
            p.sku === key ||
            p.id === key ||
            p.slug.toLowerCase() === key.toLowerCase() ||
            (p.sku && p.sku.toLowerCase() === key.toLowerCase()),
        ) ?? null
      );
    } catch {
      return null;
    }
  }
}

export type CatalogFilterValue = {
  value: string;
  label: string;
  count: number;
  /** Значение выбрано текущими критериями (доступно для снятия даже при count=0) */
  selected?: boolean;
  /** false — выбор значения не даст товаров: UI помечает вариант недоступным */
  available?: boolean;
};
export type CatalogFilterAttr = {
  id: string;
  code: string;
  name: string;
  type: string;
  unit?: string | null;
  /** Подсказка категории: задаётся бэкендом при одинаковых названиях атрибутов */
  category?: string | null;
  /** Группировка по категории (область — родитель с детьми): id ребёнка */
  category_id?: string | null;
  /** Название категории-группы для заголовка в сайдбаре */
  category_name?: string | null;
  /** Клиентский флаг: блок исчез из ответа после сужения фильтров —
   *  рендерится приглушённым, чтобы сайдбар не «прыгал» */
  inactive?: boolean;
  values: CatalogFilterValue[];
  filter_mode?: "discrete" | "numeric";
  precision?: number;
  min?: number;
  max?: number;
  step?: number;
  group?: string | null;
  group_sort_order?: number;
  numeric_values?: string[];
};

export interface CatalogFacetParams {
  q?: string;
  category_ids?: string[];
  brand_ids?: string[];
  is_new?: boolean;
  attr?: Record<string, string[]>;
  attr_ranges?: Record<string, { min?: number; max?: number }>;
}

/**
 * Умные фасеты: параметры зеркалируют fetchProducts. Бэкенд считает каждое
 * значение со всеми критериями, кроме выбора в самом блоке (disjunctive),
 * поэтому в одном блоке можно свободно менять выбор без обнуления.
 */
export async function fetchCatalogFilters(params?: CatalogFacetParams): Promise<CatalogFilterAttr[]> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  for (const id of params?.category_ids ?? []) qs.append("filter[category_id][]", id);
  for (const id of params?.brand_ids ?? []) qs.append("filter[brand_id][]", id);
  if (params?.is_new != null) qs.set("filter[is_new]", params.is_new ? "1" : "0");
  if (params?.attr) {
    for (const [code, vals] of Object.entries(params.attr)) {
      for (const v of vals) qs.append(`filter[attr][${code}][]`, v);
    }
  }
  if (params?.attr_ranges) {
    for (const [code, range] of Object.entries(params.attr_ranges)) {
      if (range.min != null) qs.set(`filter[attr][${code}][min]`, String(range.min));
      if (range.max != null) qs.set(`filter[attr][${code}][max]`, String(range.max));
    }
  }
  const search = qs.toString();
  const res = await request<ApiItem<CatalogFilterAttr[]>>(
    `/catalog/filters${search ? `?${search}` : ""}`,
  );
  return res.data || [];
}

export async function fetchCategories(tree = true): Promise<Category[]> {
  const res = await request<ApiItem<ApiCategory[]>>(
    `/categories${tree ? "?tree=1" : ""}`,
  );
  return (res.data || []).map(mapApiCategory);
}

export async function fetchProductIdBySlug(slug: string): Promise<string | null> {
  try {
    const res = await request<ApiItem<ApiProduct>>(`/products/${encodeURIComponent(slug)}`);
    return res.data?.id ?? null;
  } catch {
    // list search fallback
    try {
      const { items } = await fetchProducts({ q: slug, per_page: 50 });
      return items.find((p) => p.slug === slug)?.id ?? null;
    } catch {
      return null;
    }
  }
}

/** @deprecated use fetchProductIdBySlug */
export const resolveProductIdBySlug = fetchProductIdBySlug;

export type ShopOrganization = {
  legalName: string | null;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  legalAddress: string | null;
  bankName: string | null;
  bankBik: string | null;
  bankAccount: string | null;
  bankCorrAccount: string | null;
};

export type ShopContactFaq = { q: string; a: string };

export type ShopContacts = {
  phone: string | null;
  phoneRaw: string | null;
  email: string | null;
  address: string | null;
  workHours: string | null;
  phones: string[];
  emails: string[];
  topbar: {
    delivery: string | null;
    warranty: string | null;
  };
  footer: {
    brand: string | null;
    about: string | null;
    copyright: string | null;
  };
  organization: ShopOrganization;
  faq: ShopContactFaq[];
  map: {
    lat: number | null;
    lng: number | null;
    zoom: number;
  };
  mapEmbed: string | null;
  site: ShopSite;
};

/** Storefront chrome branding (`GET /settings/site`, also nested on contacts). */
export type ShopHeadSnippet = {
  id: string;
  name: string;
  html: string;
  enabled: boolean;
};

export type ShopSite = {
  title: string;
  titleSuffix: string;
  description: string;
  brand: string;
  logoUrl: string | null;
  ogImageUrl: string | null;
  headSnippets: ShopHeadSnippet[];
  vatPriceHint: string;
  vatTotalLabel: string;
  pdfThanks: string;
  pdfFooter: string | null;
  brandPrimary: string;
  brandAccent: string;
};

export const emptySite = (): ShopSite => ({
  title: "",
  titleSuffix: "",
  description: "",
  brand: "",
  logoUrl: null,
  ogImageUrl: null,
  headSnippets: [],
  vatPriceHint: "с НДС 5%",
  vatTotalLabel: "Итоговая стоимость (НДС 5% включён)",
  pdfThanks: "Благодарим за сотрудничество!",
  pdfFooter: null,
  brandPrimary: "#4A22CE",
  brandAccent: "#F55688",
});

type ApiSitePayload = {
  title?: string | null;
  title_suffix?: string | null;
  description?: string | null;
  brand?: string | null;
  logo_url?: string | null;
  og_image_url?: string | null;
  head_snippets?: Array<{
    id?: string;
    name?: string;
    html?: string;
    enabled?: boolean;
  }>;
  vat_price_hint?: string | null;
  vat_total_label?: string | null;
  pdf_thanks?: string | null;
  pdf_footer?: string | null;
  brand_primary?: string | null;
  brand_accent?: string | null;
};

function mapSite(raw?: ApiSitePayload | null): ShopSite {
  const title = String(raw?.title || "").trim();
  const brand = String(raw?.brand || title).trim();
  const snippets = Array.isArray(raw?.head_snippets) ? raw.head_snippets : [];
  return {
    title,
    titleSuffix: String(raw?.title_suffix || "").trim(),
    description: String(raw?.description || "").trim(),
    brand,
    logoUrl: absoluteMediaUrl(raw?.logo_url || null),
    ogImageUrl: absoluteMediaUrl(raw?.og_image_url || null),
    headSnippets: snippets.map((s, i) => ({
      id: String(s.id || `snip-${i}`),
      name: String(s.name || "Сниппет"),
      html: String(s.html || ""),
      enabled: s.enabled !== false,
    })),
    vatPriceHint: String(raw?.vat_price_hint || "").trim() || "с НДС 5%",
    vatTotalLabel:
      String(raw?.vat_total_label || "").trim() || "Итоговая стоимость (НДС 5% включён)",
    pdfThanks: String(raw?.pdf_thanks || "").trim() || "Благодарим за сотрудничество!",
    pdfFooter: raw?.pdf_footer ? String(raw.pdf_footer).trim() || null : null,
    brandPrimary: String(raw?.brand_primary || "").trim() || "#4A22CE",
    brandAccent: String(raw?.brand_accent || "").trim() || "#F55688",
  };
}

let siteCache: ShopSite | null = null;

export function getCachedSite(): ShopSite | null {
  return siteCache;
}

export function formatPageTitle(
  page: string | null | undefined,
  site: ShopSite | null,
): string {
  const home = (site?.title || site?.brand || "").trim();
  const suffix = (site?.titleSuffix || site?.brand || site?.title || "").trim();
  const pageTitle = (page || "").trim();
  if (!pageTitle) return home;
  if (!suffix || pageTitle === home || pageTitle.includes(suffix)) return pageTitle;
  return `${pageTitle} — ${suffix}`;
}

export type SeoDocument = {
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

/**
 * Same payload as bot HTML (`SeoDocumentBuilder`).
 * Redirect documents are returned as-is (`redirect_to`) so the skin can send
 * the human to the canonical address instead of a 404 (plan.txt P0.2).
 */
export async function fetchSeoDocument(path: string): Promise<SeoDocument | null> {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const qs = new URLSearchParams({ path });
  try {
    const res = await request<ApiItem<SeoDocument>>(`/seo/document?${qs.toString()}`, {
      headers: origin ? { "X-Seo-Site": origin } : undefined,
    });
    const doc = res.data;
    if (!doc || doc.kind === "not_found") return null;
    return doc;
  } catch {
    return null;
  }
}

export async function fetchSite(): Promise<ShopSite> {
  try {
    const res = await request<ApiItem<ApiSitePayload>>("/settings/site");
    siteCache = mapSite(res.data);
    return siteCache;
  } catch {
    return siteCache || emptySite();
  }
}

const emptyOrganization = (): ShopOrganization => ({
  legalName: null,
  inn: null,
  kpp: null,
  ogrn: null,
  legalAddress: null,
  bankName: null,
  bankBik: null,
  bankAccount: null,
  bankCorrAccount: null,
});

export async function fetchContacts(): Promise<ShopContacts> {
  const empty: ShopContacts = {
    phone: null,
    phoneRaw: null,
    email: null,
    address: null,
    workHours: null,
    phones: [],
    emails: [],
    topbar: { delivery: null, warranty: null },
    footer: { brand: null, about: null, copyright: null },
    organization: emptyOrganization(),
    faq: [],
    map: { lat: null, lng: null, zoom: 10 },
    mapEmbed: null,
    site: emptySite(),
  };
  try {
    const res = await request<
      ApiItem<{
        phone?: string | null;
        phone_raw?: string | null;
        email?: string | null;
        address?: string | null;
        work_hours?: string | null;
        phones?: string[];
        emails?: string[];
        topbar?: { delivery?: string | null; warranty?: string | null };
        footer?: {
          brand?: string | null;
          about?: string | null;
          copyright?: string | null;
        };
        organization?: {
          legal_name?: string | null;
          inn?: string | null;
          kpp?: string | null;
          ogrn?: string | null;
          legal_address?: string | null;
          bank_name?: string | null;
          bank_bik?: string | null;
          bank_account?: string | null;
          bank_corr_account?: string | null;
        } | null;
        faq?: Array<{ q?: string; a?: string }>;
        yandex_map?: {
          center?: { lat?: number; lng?: number };
          zoom?: number;
        };
        map_embed?: string | null;
        site?: ApiSitePayload;
      }>
    >("/settings/contacts");
    const d = res.data || {};
    const phone = d.phone || d.phones?.[0] || null;
    const email = d.email || d.emails?.[0] || null;
    const phoneRaw =
      d.phone_raw ||
      (phone ? phone.replace(/\D+/g, "") : null);
    const org = d.organization || {};
    const site = mapSite(d.site);
    if (site.title || site.brand) siteCache = site;
    return {
      phone,
      phoneRaw,
      email,
      address: d.address ?? null,
      workHours: d.work_hours ?? null,
      phones: d.phones || (phone ? [phone] : []),
      emails: d.emails || (email ? [email] : []),
      topbar: {
        delivery: d.topbar?.delivery ?? null,
        warranty: d.topbar?.warranty ?? null,
      },
      footer: {
        brand: d.footer?.brand || site.brand || org.legal_name || null,
        about: d.footer?.about ?? null,
        copyright: d.footer?.copyright ?? null,
      },
      organization: {
        legalName: org.legal_name ?? null,
        inn: org.inn ?? null,
        kpp: org.kpp ?? null,
        ogrn: org.ogrn ?? null,
        legalAddress: org.legal_address ?? null,
        bankName: org.bank_name ?? null,
        bankBik: org.bank_bik ?? null,
        bankAccount: org.bank_account ?? null,
        bankCorrAccount: org.bank_corr_account ?? null,
      },
      faq: (d.faq || [])
        .map((row) => ({
          q: String(row.q || "").trim(),
          a: String(row.a || "").trim(),
        }))
        .filter((row) => row.q && row.a),
      map: {
        lat: d.yandex_map?.center?.lat ?? null,
        lng: d.yandex_map?.center?.lng ?? null,
        zoom: d.yandex_map?.zoom ?? 10,
      },
      mapEmbed: typeof d.map_embed === "string" && d.map_embed.trim() ? d.map_embed : null,
      site,
    };
  } catch {
    return empty;
  }
}

/** POST /contact-requests — feedback form on /contacts */
export async function submitContactRequest(body: {
  name: string;
  phone?: string;
  email?: string;
  message?: string;
  source?: string;
}): Promise<{ id: string; status: string; message: string }> {
  const res = await request<
    ApiItem<{ id: string; status: string; message?: string }>
  >("/contact-requests", {
    method: "POST",
    json: {
      name: body.name,
      phone: body.phone || null,
      email: body.email || null,
      message: body.message || null,
      source: body.source || "contacts_page",
    },
  });
  const d = res.data;
  return {
    id: d?.id || "",
    status: d?.status || "new",
    message: d?.message || "Заявка принята",
  };
}

/* ── 152-ФЗ: отзыв согласия («право на забвение») ─────────────────── */

/** Этап 1: заявка на удаление ПД → код подтверждения на email. */
export async function requestPdWithdrawal(
  email: string,
  phone?: string,
): Promise<{ message: string; email: string; expires_in_minutes: number }> {
  const res = await request<
    ApiItem<{ message: string; email: string; expires_in_minutes: number }>
  >("/consent/withdraw", {
    method: "POST",
    json: { email: email.trim(), phone: phone?.trim() || null },
    auth: false,
  });
  return res.data;
}

/** Этап 2: подтверждение кодом из письма → обезличивание данных. */
export async function confirmPdWithdrawal(
  email: string,
  code: string,
): Promise<{ message: string; status: string }> {
  const res = await request<ApiItem<{ message: string; status: string }>>(
    "/consent/withdraw/confirm",
    {
      method: "POST",
      json: { email: email.trim(), code: code.trim() },
      auth: false,
    },
  );
  return res.data;
}

/* ── Menus (header / footer / home) ───────────────────── */

export type MenuNavItem = {
  id: string;
  label: string;
  href: string;
  type?: string;
  /** Catalog category slug when type=category */
  categorySlug?: string;
  categoryId?: string;
  /** Category description or empty for URL items */
  description?: string;
  icon?: string;
  children?: MenuNavItem[];
};

type ApiMenuItem = {
  id: string;
  title: string;
  type?: string;
  url?: string | null;
  href?: string | null;
  sort_order?: number;
  category?: {
    id?: string;
    name?: string;
    slug?: string;
    icon?: string | null;
    description?: string | null;
  } | null;
  children?: ApiMenuItem[];
};

/** Канонический адрес категории: плоское ЧПУ /catalog/{slug} (plan.txt P0.4). */
export function categoryHref(slug: string): string {
  return `/catalog/${encodeURIComponent(slug)}`;
}

/** Map CMS href to SPA routes used by the Vite storefront. */
export function normalizeMenuHref(href: string | null | undefined): string {
  if (!href) return "/";
  let h = href.trim();
  // Absolute same-origin path
  if (h.startsWith("http://") || h.startsWith("https://")) {
    try {
      const u = new URL(h);
      h = u.pathname + u.search + u.hash;
    } catch {
      return h;
    }
  }
  return h.startsWith("/") ? h : `/${h}`;
}

function mapMenuItem(i: ApiMenuItem): MenuNavItem {
  const cat = i.category;
  let href = normalizeMenuHref(i.href || i.url || "/");
  // Категории — ЧПУ /catalog/{slug} (как их генерирует MenuController)
  if (i.type === "category" && cat?.slug) {
    href = categoryHref(cat.slug);
  }
  return {
    id: i.id,
    label: i.title || cat?.name || "Пункт",
    href,
    type: i.type,
    categorySlug: cat?.slug || undefined,
    categoryId: cat?.id || undefined,
    description: cat?.description?.trim() || undefined,
    icon: cat?.icon || undefined,
    children: (i.children || []).map(mapMenuItem),
  };
}

export async function fetchMenu(code: string): Promise<MenuNavItem[]> {
  try {
    const res = await request<
      ApiItem<{ id?: string; code?: string; name?: string; items?: ApiMenuItem[] }>
    >(`/menus/${encodeURIComponent(code)}`);
    const items = res.data?.items || [];
    return items.map(mapMenuItem);
  } catch {
    return [];
  }
}

/* ── Безопасность аккаунта (смена пароля с кодом на почту) ── */

export async function requestPasswordChangeCode(): Promise<string> {
  const res = await request<ApiItem<{ message?: string }>>(
    "/auth/password/change-code",
    { method: "POST", auth: true, json: {} },
  );
  return res.data?.message || "Код отправлен на вашу почту.";
}

export async function changeAccountPassword(
  code: string,
  password: string,
): Promise<string> {
  const res = await request<ApiItem<{ message?: string }>>("/auth/password", {
    method: "POST",
    auth: true,
    json: { code, password, password_confirmation: password },
  });
  return res.data?.message || "Пароль изменён.";
}

export async function requestEmailChangeCode(email: string): Promise<string> {
  const res = await request<ApiItem<{ message?: string }>>("/auth/email/change-code", {
    method: "POST",
    auth: true,
    json: { email },
  });
  return res.data?.message || "Код отправлен на новый email.";
}

export async function changeAccountEmail(email: string, code: string): Promise<ApiAuthUser> {
  const res = await request<ApiItem<ApiAuthUser>>("/auth/email", {
    method: "POST",
    auth: true,
    json: { email, code },
  });
  return res.data;
}

export async function forgotPassword(email: string): Promise<string> {
  const res = await request<ApiItem<{ message?: string }>>(
    "/auth/forgot-password",
    { method: "POST", json: { email } },
  );
  return (
    res.data?.message ||
    "Если аккаунт существует, код отправлен на почту."
  );
}

export async function resetPassword(
  email: string,
  code: string,
  password: string,
): Promise<string> {
  const res = await request<ApiItem<{ message?: string }>>(
    "/auth/reset-password",
    {
      method: "POST",
      json: { email, code, password, password_confirmation: password },
    },
  );
  return res.data?.message || "Пароль изменён. Войдите с новым паролем.";
}

/* ── Homepage CMS content ─────────────────────────────── */

export type HomeWhyPoint = {
  icon: string;
  title: string;
  desc: string;
};

export type HomeWhySlide = {
  id: string;
  eyebrow: string;
  title: string;
  lead: string;
  accent: "primary" | "accent" | "success";
  points: HomeWhyPoint[];
};

export type HomeStat = { value: string; label: string };

/** Hero-блок главной: пустая строка = не задано в CMS (рендерится дефолт). */
export type HomeHero = {
  badge: string;
  titlePrefix: string;
  titleHighlight: string;
  titleSuffix: string;
  subtitle: string;
  ctaCatalog: string;
  ctaConfigurator: string;
  /** Ссылка кнопки каталога — href текстового кода hero.cta_catalog (если задан) */
  ctaCatalogHref: string;
  /** Ссылка кнопки «Собрать сервер» — href текстового кода hero.cta_configurator */
  ctaConfiguratorHref: string;
  scrollHint: string;
  stats: HomeStat[];
};

export type HomeBanner = { title: string; subtitle: string; cta: string; href: string };
export type HomeSectionText = { eyebrow: string; title: string; action: string };
export type HomeSections = {
  categories: HomeSectionText;
  hotDeals: HomeSectionText;
  bestsellers: HomeSectionText;
  reviews: HomeSectionText;
  blog: HomeSectionText;
  faq: HomeSectionText;
};

export type HomeContent = {
  whyStory: { slides: HomeWhySlide[] };
  topbarLines: string[];
  hero: HomeHero;
  banner: HomeBanner;
  sections: HomeSections;
  /** CMS texts_map.logo — company mark for print / docs */
  logoUrl: string | null;
  footerAbout: string | null;
  faq: Array<{ q: string; a: string }>;
  reviews: Array<{
    id: string;
    author: string;
    rating: number;
    verified?: boolean;
    text: string;
    date?: string;
  }>;
  cta?: {
    title?: string;
    subtitle?: string;
    primary?: string;
    secondary?: string;
  };
  raw: Record<string, unknown>;
};

const emptySections = (): HomeSections => ({
  categories: { eyebrow: "", title: "", action: "" },
  hotDeals: { eyebrow: "", title: "", action: "" },
  bestsellers: { eyebrow: "", title: "", action: "" },
  reviews: { eyebrow: "", title: "", action: "" },
  blog: { eyebrow: "", title: "", action: "" },
  faq: { eyebrow: "", title: "", action: "" },
});

const emptyHero = (): HomeHero => ({
  badge: "",
  titlePrefix: "",
  titleHighlight: "",
  titleSuffix: "",
  subtitle: "",
  ctaCatalog: "",
  ctaConfigurator: "",
  ctaCatalogHref: "",
  ctaConfiguratorHref: "",
  scrollHint: "",
  stats: [],
});

export async function fetchHomeContent(): Promise<HomeContent> {
  const empty: HomeContent = {
    whyStory: { slides: [] },
    topbarLines: [],
    hero: emptyHero(),
    banner: { title: "", subtitle: "", cta: "", href: "" },
    sections: emptySections(),
    logoUrl: null,
    footerAbout: null,
    faq: [],
    reviews: [],
    raw: {},
  };
  try {
    const res = await request<ApiItem<Record<string, unknown>>>("/settings/home");
    const d = res.data || {};
    const why = (d.why_story || d.whyStory || {}) as {
      slides?: Array<Record<string, unknown>>;
    };
    const slides: HomeWhySlide[] = (why.slides || [])
      .map((s, i) => {
        const accentRaw = String(s.accent || "primary");
        const accent =
          accentRaw === "accent" || accentRaw === "success" ? accentRaw : "primary";
        const points = Array.isArray(s.points)
          ? (s.points as Array<Record<string, unknown>>).map((p) => ({
              icon: String(p.icon || "Check"),
              title: String(p.title || ""),
              desc: String(p.desc || p.description || ""),
            }))
          : [];
        return {
          id: String(s.id || `slide-${i}`),
          eyebrow: String(s.eyebrow || ""),
          title: String(s.title || ""),
          lead: String(s.lead || s.subtitle || ""),
          accent: accent as HomeWhySlide["accent"],
          points,
        };
      })
      .filter((s) => s.title || s.lead);

    const faq = Array.isArray(d.faq)
      ? (d.faq as Array<Record<string, unknown>>).map((f) => ({
          q: String(f.q || f.question || ""),
          a: String(f.a || f.answer || ""),
        }))
      : [];

    const reviews = Array.isArray(d.reviews)
      ? (d.reviews as Array<Record<string, unknown>>).map((r, i) => ({
          id: String(r.id || `r${i}`),
          author: String(r.author || ""),
          rating: Number(r.rating) || 5,
          verified: Boolean(r.verified),
          text: String(r.text || ""),
          date: r.date ? String(r.date) : undefined,
        }))
      : [];

    const cta = (d.cta && typeof d.cta === "object" ? d.cta : {}) as Record<
      string,
      unknown
    >;

    const topbar = (d.topbar && typeof d.topbar === "object" ? d.topbar : {}) as {
      lines?: unknown;
    };
    const textsMap =
      d.texts_map && typeof d.texts_map === "object" && !Array.isArray(d.texts_map)
        ? (d.texts_map as Record<string, unknown>)
        : {};
    // Полный список текстовых кодов с href (href в texts_map не попадает)
    const textsRows = Array.isArray(d.texts)
      ? (d.texts as Array<Record<string, unknown>>)
      : [];

    // Поле блога или texts_map-код. texts_map приоритетнее: админ-тексты —
    // канонический источник, блоб sections/hero может отставать от них.
    const pick = (value: unknown, code: string): string => {
      const fromMap = String(textsMap[code] ?? "").trim();
      if (fromMap) return fromMap;
      return typeof value === "string" ? value.trim() : "";
    };
    const obj = (value: unknown): Record<string, unknown> =>
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};

    const heroRaw = obj(d.hero);
    // href текстового кода — ссылка CTA-кнопки, задаётся в админке
    // (Настройки → Главная → Текстовые поля, поле «Ссылка»)
    const looksLikeHref = (s: string): boolean =>
      /^https?:\/\//i.test(s) || (s.startsWith("/") && !/\s/.test(s));
    const textRow = (code: string): Record<string, unknown> | undefined =>
      textsRows.find((r) => String(r.code ?? "") === code);
    const textHref = (code: string): string => {
      const row = textRow(code);
      const href = String(row?.href ?? "").trim();
      if (href) return href;
      // Ссылку могли вписать прямо в текст кода (в поле «Текст») —
      // принимаем её как href, чтобы кнопка не игнорировала её.
      const value = String(row?.value ?? "").trim();
      return looksLikeHref(value) ? value : "";
    };
    // Подпись кнопки: если в текст кода вписали ссылку — показываем
    // дефолтную подпись, а не URL.
    const textLabel = (value: unknown, code: string): string => {
      const text = pick(value, code);
      return looksLikeHref(text) ? "" : text;
    };
    const hero: HomeHero = {
      badge: pick(heroRaw.badge, "hero.badge"),
      titlePrefix: pick(heroRaw.title_prefix, "hero.title_prefix"),
      titleHighlight: pick(heroRaw.title_highlight, "hero.title_highlight"),
      titleSuffix: pick(heroRaw.title_suffix, "hero.title_suffix"),
      subtitle: pick(heroRaw.subtitle, "hero.subtitle"),
      ctaCatalog: textLabel(heroRaw.cta_catalog, "hero.cta_catalog"),
      ctaConfigurator: textLabel(heroRaw.cta_configurator, "hero.cta_configurator"),
      ctaCatalogHref: textHref("hero.cta_catalog"),
      ctaConfiguratorHref: textHref("hero.cta_configurator"),
      scrollHint: pick(heroRaw.scroll_hint, "hero.scroll_hint"),
      stats: Array.isArray(heroRaw.stats)
        ? (heroRaw.stats as Array<Record<string, unknown>>)
            .map((s) => ({
              value: String(s.value ?? "").trim(),
              label: String(s.label ?? "").trim(),
            }))
            .filter((s) => s.value || s.label)
        : [],
    };

    const bannerRaw = obj(d.configurator_banner);
    const banner: HomeBanner = {
      title: pick(bannerRaw.title, "configurator_banner.title"),
      subtitle: pick(bannerRaw.subtitle, "configurator_banner.subtitle"),
      cta: textLabel(bannerRaw.cta, "configurator_banner.cta"),
      href: textHref("configurator_banner.cta"),
    };

    const sectionsRaw = obj(d.sections);
    const section = (key: string): HomeSectionText => {
      const raw = obj(sectionsRaw[key]);
      return {
        eyebrow: pick(raw.eyebrow, `sections.${key}.eyebrow`),
        title: pick(raw.title, `sections.${key}.title`),
        action: pick(raw.action, `sections.${key}.action`),
      };
    };
    const sections: HomeSections = {
      categories: section("categories"),
      hotDeals: section("hot_deals"),
      bestsellers: section("bestsellers"),
      reviews: section("reviews"),
      blog: section("blog"),
      faq: section("faq"),
    };
    const lineFromMap = (key: string, index: number): string => {
      if (Object.prototype.hasOwnProperty.call(textsMap, key)) {
        return String(textsMap[key] ?? "").trim();
      }
      if (Array.isArray(topbar.lines) && topbar.lines[index] != null) {
        return String(topbar.lines[index] ?? "").trim();
      }
      return "";
    };
    // Keep index 0/1 — empty slot means hide, do not compact
    const topbarLines = [lineFromMap("topbar.line_0", 0), lineFromMap("topbar.line_1", 1)];
    const footer = (d.footer && typeof d.footer === "object" ? d.footer : {}) as {
      about?: unknown;
    };
    const footerAbout = footer.about ? String(footer.about).trim() || null : null;

    const logoRaw = String(textsMap.logo || "").trim();

    return {
      whyStory: { slides },
      topbarLines,
      hero,
      banner,
      sections,
      logoUrl: absoluteMediaUrl(logoRaw) || (logoRaw || null),
      footerAbout,
      faq,
      reviews,
      cta: {
        title: cta.title ? String(cta.title) : undefined,
        subtitle: cta.subtitle ? String(cta.subtitle) : undefined,
        primary: cta.primary ? String(cta.primary) : undefined,
        secondary: cta.secondary ? String(cta.secondary) : undefined,
      },
      raw: d,
    };
  } catch {
    return empty;
  }
}

export type ApiBrand = { id: string; name: string; slug: string };

export async function fetchBrands(): Promise<ApiBrand[]> {
  try {
    const res = await request<ApiItem<ApiBrand[]>>("/brands");
    return res.data || [];
  } catch {
    return [];
  }
}

export type CommerceMethod = {
  code: string;
  name: string;
  driver?: string;
  delivery_category_id?: string | null;
  /** Категория доставки на витрине: визуальная группа типов; null = отдельный тип. */
  delivery_category?: { id: string; slug: string; name: string; sort_order?: number } | null;
  sort_order?: number;
  min_amount?: number | string | null;
  max_amount?: number | string | null;
  config?: {
    payer_mode?: string | null;
    payer_label?: string | null;
    requires_address?: boolean;
    address?: string | null;
    arrival_variant?: string | null;
    freeFrom?: number | null;
    tariffs?: unknown;
    description?: string | null;
    requires_legal?: boolean;
    allows_requisites_file?: boolean;
  };
};

export type DeliveryCategoryNode = {
  id: string;
  parent_id?: string | null;
  code: string;
  slug: string;
  name: string;
  description?: string | null;
  depth?: number;
  sort_order?: number;
  children?: DeliveryCategoryNode[];
};

export async function fetchDeliveryCategories(): Promise<DeliveryCategoryNode[]> {
  try {
    const res = await request<ApiItem<DeliveryCategoryNode[]>>("/delivery-categories");
    return res.data || [];
  } catch {
    return [];
  }
}

export async function fetchDeliveryMethods(): Promise<CommerceMethod[]> {
  try {
    const res = await request<ApiItem<CommerceMethod[]>>("/delivery-methods");
    return res.data || [];
  } catch {
    return [];
  }
}

export type ShippingQuoteResult = {
  available: boolean;
  delivery_method_code?: string;
  driver?: string;
  price: number;
  price_for_order: number;
  display_note?: string | null;
  eta?: string | null;
  payer_mode?: string | null;
  payer_label?: string | null;
  quote_token?: string | null;
  warnings?: string[];
  delivery_meta_preview?: Record<string, unknown>;
};

export async function quoteShipping(payload: {
  delivery_method_code: string;
  items: Array<{ product_id: string; qty: number }>;
  destination?: {
    city?: string;
    address?: string;
    terminal_id?: string;
    kladr?: string;
  };
  declared_value?: number;
}): Promise<ShippingQuoteResult> {
  const res = await request<ApiItem<ShippingQuoteResult>>("/shipping/quote", {
    method: "POST",
    json: payload,
    auth: false,
  });
  return res.data;
}

export type DellinCity = { id: string; name: string; code?: string | null };
export type DellinTerminal = {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
};

export async function searchDellinCities(q: string): Promise<DellinCity[]> {
  if (!q.trim()) return [];
  try {
    const res = await request<ApiItem<DellinCity[]>>(
      `/shipping/dellin/cities?q=${encodeURIComponent(q)}&limit=12`,
      { auth: false },
    );
    return res.data || [];
  } catch {
    return [];
  }
}

export async function searchDellinTerminals(city?: string): Promise<DellinTerminal[]> {
  try {
    const qs = city ? `?city=${encodeURIComponent(city)}` : "";
    const res = await request<ApiItem<DellinTerminal[]>>(
      `/shipping/dellin/terminals${qs}`,
      { auth: false },
    );
    return res.data || [];
  } catch {
    return [];
  }
}

export async function fetchPaymentMethods(): Promise<CommerceMethod[]> {
  try {
    const res = await request<ApiItem<CommerceMethod[]>>("/payment-methods");
    return res.data || [];
  } catch {
    return [];
  }
}

/* ── Blog ─────────────────────────────────────────────── */

type ApiBlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  body_markdown?: string | null;
  published_at?: string | null;
  category?: { id?: string; name?: string; slug?: string; code?: string } | null;
  author?: { id?: string; name?: string } | null;
  hide_author?: boolean | null;
  cover?: { url?: string; path?: string } | string | null;
};

// Обложка поста опциональна: без неё не рисуем картинку-заглушку.
function coverUrl(cover: ApiBlogPost["cover"]): string | null {
  if (!cover) return null;
  if (typeof cover === "string") return absoluteMediaUrl(cover);
  return absoluteMediaUrl(cover.url || cover.path);
}

export function mapApiArticle(p: ApiBlogPost): Article {
  const date = p.published_at
    ? new Date(p.published_at).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";
  const body = p.body_markdown || p.excerpt || "";
  const readingTime = Math.max(1, Math.ceil(body.split(/\s+/).length / 200));
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt || body.slice(0, 160),
    cover: coverUrl(p.cover),
    category: p.category?.name || "Блог",
    categorySlug: p.category?.slug || p.category?.code || undefined,
    author: p.author?.name || siteCache?.brand || "",
    hideAuthor: Boolean(p.hide_author),
    date,
    readingTime,
  };
}

export async function fetchBlogPosts(params?: {
  page?: number;
  per_page?: number;
  category?: string;
}): Promise<{ items: Article[]; total: number }> {
  const qs = new URLSearchParams();
  qs.set("per_page", String(params?.per_page ?? 24));
  if (params?.page) qs.set("page", String(params.page));
  if (params?.category) qs.set("filter[category]", params.category);
  const res = await request<ApiItem<ApiBlogPost[]>>(`/blog-posts?${qs}`);
  return {
    items: (res.data || []).map(mapApiArticle),
    total: Number(res.meta?.total ?? res.data?.length ?? 0),
  };
}

export async function fetchBlogPost(
  slug: string,
): Promise<(Article & { bodyMarkdown?: string }) | null> {
  try {
    const res = await request<ApiItem<ApiBlogPost>>(`/blog-posts/${encodeURIComponent(slug)}`);
    if (!res.data) return null;
    return {
      ...mapApiArticle(res.data),
      bodyMarkdown: res.data.body_markdown ?? undefined,
    };
  } catch {
    return null;
  }
}

/* ── Checkout ─────────────────────────────────────────── */

export type CheckoutPayload = {
  from_cart?: boolean;
  guest_token?: string | null;
  items?: Array<{
    product_id: string;
    qty: number;
    price_kind?: string;
    build?: { selections: Array<{ slot_id: string; product_id: string; qty: number }> };
    warranty_snapshot?: Record<string, unknown> | null;
  }>;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  guest_email?: string;
  customer_company?: string;
  customer_inn?: string;
  legal_entity_data?: Record<string, string | null | undefined>;
  promo_code?: string;
  shipping_amount?: number;
  bonus_to_spend?: number;
  delivery_method_code?: string;
  payment_method_code?: string;
  delivery_category_slug?: string;
  shipping_address?: Record<string, string | null | undefined>;
  /** Saved address-book entry (server snapshots it into the order) */
  shipping_address_id?: string;
  billing_address_id?: string;
  /** B2B requisites from the customer's legal-entity book */
  legal_entity_id?: string;
  delivery_meta?: Record<string, unknown>;
  quote_token?: string;
  customer_comment?: string;
  customer_type?: "individual" | "legal";
  idempotency_key?: string;
  /** Registered custom fields only (e.g. metrica_client_id); unknown are dropped server-side. */
  custom_fields?: Record<string, string>;
};

/* ── Warranty ─────────────────────────────────────────── */

export type WarrantyOption = {
  eligible: boolean;
  kind: "base" | "extended" | string;
  isPaid: boolean;
  termId: string;
  packageId: string;
  name: string;
  months: number | null;
  price: number;
  coverageBase: number | null;
  coefficient: number;
  markupPercent: number | null;
  notes: string[];
  excludes: Array<{ name?: string; note?: string; excluded_amount?: number }>;
  snapshot: Record<string, unknown> | null;
  serviceProductId: string | null;
  lineName: string;
};

type ApiWarrantyOption = {
  eligible?: boolean;
  kind?: string;
  is_paid?: boolean;
  term?: { id?: string; name?: string; months?: number; coefficient?: number; markup_percent?: number };
  package?: { id?: string; name?: string };
  total_months?: number | null;
  coverage_base_display?: number | null;
  warranty_price_display?: number | null;
  coefficient?: number;
  notes?: string[];
  excludes?: Array<{ name?: string; note?: string; excluded_amount?: number }>;
  snapshot?: Record<string, unknown> | null;
  service_product_id?: string | null;
  line_name?: string;
};

function mapWarrantyOption(row: ApiWarrantyOption): WarrantyOption | null {
  const termId = row.term?.id;
  const packageId = row.package?.id;
  if (!termId || !packageId) return null;
  return {
    eligible: row.eligible !== false,
    kind: row.kind || "extended",
    isPaid: Boolean(row.is_paid),
    termId,
    packageId,
    name: row.line_name || row.term?.name || row.package?.name || "Гарантия",
    months: row.total_months ?? row.term?.months ?? null,
    price: Number(row.warranty_price_display ?? 0),
    coverageBase:
      row.coverage_base_display == null ? null : Number(row.coverage_base_display),
    coefficient: Number(row.coefficient ?? row.term?.coefficient ?? 1),
    markupPercent:
      row.term?.markup_percent == null ? null : Number(row.term.markup_percent),
    notes: Array.isArray(row.notes) ? row.notes.filter(Boolean) : [],
    excludes: Array.isArray(row.excludes) ? row.excludes : [],
    snapshot: row.snapshot && typeof row.snapshot === "object" ? row.snapshot : null,
    serviceProductId: row.service_product_id || null,
    lineName: row.line_name || row.term?.name || "Гарантия",
  };
}

export async function fetchWarrantyOptions(
  idOrSlug: string,
  build?: { selections: Array<{ slot_id: string; product_id: string; qty: number }> } | null,
): Promise<WarrantyOption[]> {
  try {
    const qs = new URLSearchParams();
    if (build?.selections?.length) {
      qs.set("build", JSON.stringify(build));
    }
    const suffix = qs.toString() ? `?${qs}` : "";
    const res = await request<ApiItem<ApiWarrantyOption[]>>(
      `/products/${encodeURIComponent(idOrSlug)}/warranty-options${suffix}`,
    );
    return (res.data || [])
      .map(mapWarrantyOption)
      .filter((o): o is WarrantyOption => Boolean(o && o.eligible));
  } catch {
    return [];
  }
}

/* ── Product configurator ─────────────────────────────── */

export type ConfiguratorFilterToken = { value: string; label: string };

export type ConfiguratorFilterDef = {
  id: string;
  code: string;
  name: string;
  type: string;
  unit?: string | null;
  filter_mode?: "discrete" | "numeric";
  precision?: number;
  min?: number;
  max?: number;
  step?: number;
};

export type ConfiguratorSlotOption = {
  id: string;
  productId: string;
  name: string;
  sku?: string;
  price: number | null;
  /** «Под заказ»: option has no public price */
  onRequest?: boolean;
  isDefault: boolean;
  minQty: number;
  maxQty: number;
  filterValues?: Record<string, ConfiguratorFilterToken[]>;
};

export type ConfiguratorSlot = {
  id: string;
  attributeId: string;
  code: string;
  name: string;
  minQty: number;
  maxQty: number;
  /** Max distinct SKUs (multi-select when >1 and options.length >1) */
  maxDifferentProducts: number;
  isRequired: boolean;
  sortOrder: number;
  options: ConfiguratorSlotOption[];
};

export type ConfiguratorPlatform = {
  id: string;
  sku?: string;
  slug: string;
  name: string;
  shortDescription?: string | null;
  price: number | null;
  status: ProductStatus | null;
  /** «Под заказ»: platform has no public price */
  onRequest?: boolean;
  isDefault: boolean;
  /** Display label without leading «Сервер » */
  label: string;
};

export type ProductConfigurator = {
  productId: string;
  name?: string;
  slug?: string;
  basePrice: number | null;
  /** Admin-linked platforms (configurator_platforms), ordered by sort_order */
  platforms: ConfiguratorPlatform[];
  slots: ConfiguratorSlot[];
  /** Attributes with is_configurator_filterable — chips in slot rows */
  filters: ConfiguratorFilterDef[];
};

function platformLabel(name: string): string {
  return name.replace(/^Сервер\s+/i, "").trim() || name;
}

export async function fetchProductConfigurator(
  idOrSlug: string,
): Promise<ProductConfigurator | null> {
  try {
    const res = await request<{
      data: {
        product_id: string;
        name?: string;
        slug?: string;
        price_configurator?: { display?: number | null; is_on_request?: boolean };
        platforms?: Array<{
          id: string;
          sku?: string;
          slug?: string;
          name?: string;
          status?: ProductStatus | null;
          short_description?: string | null;
          on_request?: boolean;
          price_configurator_display?: number | null;
          is_default?: boolean;
        }>;
        slots?: Array<{
          id: string;
          attribute_id: string;
          attribute?: { code?: string; name?: string };
          min_qty?: number;
          max_qty?: number;
          max_different_products?: number;
          is_required?: boolean;
          sort_order?: number;
          whitelist?: Array<{
            id: string;
            product_id: string;
            min_qty?: number;
            max_qty?: number;
            is_default?: boolean;
            product?: {
              id: string;
              sku?: string;
              name?: string;
              on_request?: boolean;
              price_configurator_display?: number | null;
              status?: ProductStatus | null;
              filter_values?: Record<string, Array<{ value?: string; label?: string } | string>>;
            } | null;
          }>;
          /** Some resources nest products at top level */
          products?: Array<{
            id: string;
            product_id?: string;
            sku?: string;
            name?: string;
            on_request?: boolean;
            price_configurator_display?: number | null;
            status?: ProductStatus | null;
            is_default?: boolean;
            filter_values?: Record<string, Array<{ value?: string; label?: string } | string>>;
          }>;
        }>;
        filters?: Array<{
          id?: string;
          code?: string;
          name?: string;
          type?: string;
          unit?: string | null;
          filter_mode?: "discrete" | "numeric";
          precision?: number;
          min?: number;
          max?: number;
          step?: number;
          numeric_values?: string[];
        }>;
      };
    }>(`/products/${encodeURIComponent(idOrSlug)}/configurator`);

    const data = res.data;
    if (!data) return null;

    const platforms: ConfiguratorPlatform[] = (data.platforms || [])
      .filter((p) => p.id && (p.slug || p.sku))
      // Unpublished / hidden chassis are not selectable on the storefront.
      .filter((p) => !p.status || p.status === "published")
      .map((p) => {
        const name = p.name || p.slug || p.id;
        return {
          id: p.id,
          sku: p.sku,
          slug: p.slug || p.id,
          name,
          shortDescription: p.short_description ?? null,
           price: p.price_configurator_display == null ? null : Number(p.price_configurator_display),
           status: p.status ?? null,
          onRequest: p.on_request === true,
          isDefault: Boolean(p.is_default),
          label: platformLabel(name),
        };
      });
    // Opened chassis first; keep admin order for the rest (no R740 hardcode).
    platforms.sort((a, b) => {
      if (a.id === data.product_id) return -1;
      if (b.id === data.product_id) return 1;
      return 0;
    });

    const slots: ConfiguratorSlot[] = (data.slots || []).map((s) => {
      const wl = s.whitelist?.length
        ? s.whitelist
        : (s.products || []).map((p) => ({
            id: p.id,
            product_id: p.product_id || p.id,
            is_default: p.is_default,
            product: {
              id: p.id,
              sku: p.sku,
              name: p.name,
               on_request: p.on_request,
               price_configurator_display: p.price_configurator_display,
               status: p.status,
               filter_values: p.filter_values,
            },
          }));
      return {
        id: s.id,
        attributeId: s.attribute_id,
        code: s.attribute?.code || s.id,
        name: s.attribute?.name || "Слот",
        minQty: s.min_qty ?? 0,
        maxQty: s.max_qty ?? 1,
        maxDifferentProducts: Math.max(1, s.max_different_products ?? 1),
        isRequired: Boolean(s.is_required),
        sortOrder: s.sort_order ?? 0,
        options: wl
          .filter((w) => w.product || w.product_id)
          .map((w) => {
            const prod = w.product;
            const productId = w.product_id || prod?.id || "";
            const minQty =
              "min_qty" in w && w.min_qty != null ? Number(w.min_qty) : 1;
            const maxQty =
              "max_qty" in w && w.max_qty != null
                ? Number(w.max_qty)
                : (s.max_qty ?? 1);
            const rawFv = prod?.filter_values || {};
            const filterValues: Record<string, ConfiguratorFilterToken[]> = {};
            for (const [code, list] of Object.entries(rawFv)) {
              const tokens = (Array.isArray(list) ? list : [])
                .map((item) => {
                  if (typeof item === "string") {
                    return { value: item, label: item };
                  }
                  const value = String(item?.value || "").trim();
                  if (!value) return null;
                  return { value, label: String(item?.label || value) };
                })
                .filter((t): t is ConfiguratorFilterToken => Boolean(t));
              if (tokens.length) filterValues[code] = tokens;
            }
            return {
              id: w.id || productId,
              productId,
              name: prod?.name || prod?.sku || "Без названия",
              sku: prod?.sku,
               price:
                 prod?.price_configurator_display == null
                   ? null
                   : Number(prod.price_configurator_display),
               status: prod?.status ?? null,
              onRequest: prod?.on_request === true,
              isDefault: Boolean(w.is_default),
              minQty,
              maxQty,
              filterValues,
            };
          })
          .filter((o) => o.productId),
      };
    });

    const filters: ConfiguratorFilterDef[] = (data.filters || [])
      .filter((f) => f.code && f.name)
      .map((f) => ({
        id: String(f.id || f.code),
        code: String(f.code),
        name: String(f.name),
        type: String(f.type || "text"),
        unit: f.unit ?? null,
        filter_mode: f.filter_mode === "numeric" ? "numeric" : "discrete",
        precision: f.precision == null ? undefined : Number(f.precision),
        min: f.min == null ? undefined : Number(f.min),
        max: f.max == null ? undefined : Number(f.max),
        step: f.step == null ? undefined : Number(f.step),
        numeric_values: Array.isArray(f.numeric_values) ? f.numeric_values.map(String) : undefined,
      }));

    return {
      productId: data.product_id,
      name: data.name,
      slug: data.slug,
       basePrice:
         data.price_configurator?.display == null
           ? null
           : Number(data.price_configurator.display),
      platforms,
      slots: slots.sort((a, b) => a.sortOrder - b.sortOrder),
      filters,
    };
  } catch {
    return null;
  }
}

export async function validateProductBuild(
  idOrSlug: string,
  selections: Array<{ slot_id: string; product_id: string; qty: number }>,
): Promise<{ ok: boolean; total: number; errors: string[]; warnings: string[]; lines: unknown[] }> {
  try {
    const res = await request<{
      data: {
        ok?: boolean;
        total_display?: number;
        errors?: string[];
        warnings?: string[];
        lines?: unknown[];
      };
    }>(`/products/${encodeURIComponent(idOrSlug)}/configurator/validate`, {
      method: "POST",
      json: { selections },
    });
    const d = res.data || {};
    return {
      ok: Boolean(d.ok),
      total: Number(d.total_display ?? 0),
      errors: d.errors || [],
      // Правила совместимости информационные: сервер кладёт их в warnings
      warnings: d.warnings || [],
      lines: d.lines || [],
    };
  } catch (e) {
    if (e instanceof StorefrontApiError) {
      return { ok: false, total: 0, errors: [e.message], warnings: [], lines: [] };
    }
    return { ok: false, total: 0, errors: ["Ошибка валидации"], warnings: [], lines: [] };
  }
}

export type CheckoutOrder = {
  id: string;
  number: string;
  total: number | string;
  subtotal?: number | string;
  bonus_spent?: number | string;
  bonus_spent_points?: number | string;
  bonus_earned_points?: number | string;
  shipping_amount?: number | string;
  customer_email?: string;
};

export async function placeCheckout(payload: CheckoutPayload): Promise<CheckoutOrder> {
  const fromCartPayload = { ...payload, from_cart: true };
  delete fromCartPayload.items;
  const res = await request<ApiItem<CheckoutOrder>>("/checkout", {
    method: "POST",
    json: fromCartPayload,
  });
  return res.data;
}

/* ── Auth + account orders ────────────────────────────── */

export type ApiAuthUser = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  type?: string;
  bonus_balance?: number;
  profile?: {
    first_name?: string | null;
    last_name?: string | null;
  } | null;
};

export async function loginCustomer(
  login: string,
  password: string,
): Promise<{ token: string; user: ApiAuthUser }> {
  const res = await request<ApiItem<{ token: string; user: ApiAuthUser }>>("/auth/login", {
    method: "POST",
    json: { login, password },
    auth: false,
  });
  setAuthToken(res.data.token);
  return res.data;
}

/** Регистрация: аккаунт создаётся неподтверждённым, код уходит на email. */
export async function registerCustomer(body: {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  phone?: string;
  type?: "individual" | "legal";
}): Promise<{ needs_verification: true; email: string }> {
  const res = await request<ApiItem<{ needs_verification: true; email: string }>>(
    "/auth/register",
    {
      method: "POST",
      json: body,
      auth: false,
    },
  );
  return res.data;
}

/** Подтверждение email кодом из письма: активирует аккаунт и логинит. */
export async function verifyRegistrationEmail(
  email: string,
  code: string,
): Promise<{ token: string; user: ApiAuthUser }> {
  const res = await request<ApiItem<{ token: string; user: ApiAuthUser }>>(
    "/auth/verify-email",
    {
      method: "POST",
      json: { email, code },
      auth: false,
    },
  );
  setAuthToken(res.data.token);
  return res.data;
}

export async function resendRegistrationCode(email: string): Promise<void> {
  await request("/auth/resend-verification", {
    method: "POST",
    json: { email },
    auth: false,
  });
}

export async function logoutCustomer(): Promise<void> {
  try {
    if (getAuthToken()) {
      await request("/auth/logout", { method: "POST" });
    }
  } catch {
    /* ignore */
  } finally {
    setAuthToken(null);
  }
}

export async function updateCustomerProfile(body: {
  name?: string;
  phone?: string | null;
  profile?: { first_name?: string | null; last_name?: string | null };
}): Promise<ApiAuthUser> {
  const res = await request<ApiItem<ApiAuthUser>>("/auth/me", {
    method: "PUT",
    json: body,
  });
  return res.data;
}

export async function fetchAuthMe(): Promise<ApiAuthUser | null> {
  if (!getAuthToken()) return null;
  try {
    const res = await request<ApiItem<ApiAuthUser>>("/auth/me");
    return res.data;
  } catch {
    setAuthToken(null);
    return null;
  }
}

export type AccountOrder = {
  id: string;
  number: string;
  date: string;
  status: string;
  statusCode: string;
  tone: "success" | "default" | "warning" | "muted";
  total: number;
  itemsCount: number;
  bonusesEarned: number;
  bonusesSpent: number;
};

function statusTone(code: string | undefined): AccountOrder["tone"] {
  const c = (code || "").toLowerCase();
  if (["delivered", "completed", "done", "закрыт"].some((x) => c.includes(x))) return "success";
  if (["new", "processing", "pending", "оплат", "сборк"].some((x) => c.includes(x)))
    return "warning";
  if (["shipped", "shipping", "transit", "в_пути", "delivery"].some((x) => c.includes(x)))
    return "default";
  return "muted";
}

export async function fetchAccountOrders(params?: {
  page?: number;
  per_page?: number;
}): Promise<{ items: AccountOrder[]; total: number }> {
  const qs = new URLSearchParams();
  qs.set("per_page", String(params?.per_page ?? 20));
  if (params?.page) qs.set("page", String(params.page));
  const res = await request<{
    data: Array<{
      id: string;
      number?: string;
      status?: { code?: string; name?: string } | null;
      total?: string | number;
      bonus_earned_points?: string | number;
      bonus_spent_points?: string | number;
      placed_at?: string | null;
      created_at?: string | null;
      items?: unknown[];
    }>;
    meta?: { total?: number };
  }>(`/account/orders?${qs}`);

  const items = (res.data || []).map((o) => {
    const placed = o.placed_at || o.created_at;
    return {
      id: o.id,
      number: o.number || o.id.slice(0, 8),
      date: placed
        ? new Date(placed).toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : "—",
      status: o.status?.name || o.status?.code || "—",
      statusCode: o.status?.code || "",
      tone: statusTone(o.status?.code),
      total: Number(o.total) || 0,
      itemsCount: Array.isArray(o.items) ? o.items.length : 0,
      bonusesEarned: Number(o.bonus_earned_points) || 0,
      bonusesSpent: Number(o.bonus_spent_points) || 0,
    } satisfies AccountOrder;
  });

  return { items, total: Number(res.meta?.total ?? items.length) };
}

export type AccountOrderDetail = AccountOrder & {
  items: Array<{
    id: string;
    name: string;
    sku?: string;
    qty: number;
    unitPrice: number;
    total: number;
    priceKind?: string;
    /** «Под заказ»: no price yet — admin sets it manually */
    onRequest?: boolean;
  }>;
  statusHistory: Array<{
    id: string;
    from?: string | null;
    to?: string | null;
    toCode?: string | null;
    at: string;
  }>;
  documents: Array<{
    id: string;
    title?: string | null;
    type?: string;
    typeName?: string | null;
    downloadUrl: string;
  }>;
  shippingAmount: number;
  deliveryMethod?: string | null;
  paymentMethod?: string | null;
};

export async function fetchAccountOrder(id: string): Promise<AccountOrderDetail> {
  const res = await request<
    ApiItem<{
      id: string;
      number?: string;
      status?: { code?: string; name?: string } | null;
      total?: string | number;
      shipping_amount?: string | number;
      bonus_earned_points?: string | number;
      bonus_spent_points?: string | number;
      placed_at?: string | null;
      created_at?: string | null;
      delivery_method_code?: string | null;
      payment_method_code?: string | null;
      items?: Array<{
        id: string;
        name?: string;
        sku?: string;
        qty?: number;
        unit_price?: string | number;
        total?: string | number;
        price_kind?: string;
        on_request?: boolean;
      }>;
      status_history?: Array<{
        id: string;
        from?: string | null;
        to?: string | null;
        to_code?: string | null;
        created_at?: string;
      }>;
      documents?: Array<{
        id: string;
        title?: string | null;
        type?: string;
        type_name?: string | null;
        download_url?: string;
      }>;
    }>
  >(`/account/orders/${encodeURIComponent(id)}`);
  const o = res.data;
  const placed = o.placed_at || o.created_at;
  return {
    id: o.id,
    number: o.number || o.id.slice(0, 8),
    date: placed
      ? new Date(placed).toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "—",
    status: o.status?.name || o.status?.code || "—",
    statusCode: o.status?.code || "",
    tone: statusTone(o.status?.code),
    total: Number(o.total) || 0,
    itemsCount: Array.isArray(o.items) ? o.items.length : 0,
    bonusesEarned: Number(o.bonus_earned_points) || 0,
    bonusesSpent: Number(o.bonus_spent_points) || 0,
    shippingAmount: Number(o.shipping_amount) || 0,
    deliveryMethod: o.delivery_method_code || null,
    paymentMethod: o.payment_method_code || null,
    items: (o.items || []).map((i) => ({
      id: i.id,
      name: i.name || "Товар",
      sku: i.sku,
      qty: Number(i.qty) || 1,
      unitPrice: Number(i.unit_price) || 0,
      total: Number(i.total) || 0,
      priceKind: i.price_kind,
      onRequest: i.on_request === true,
    })),
    statusHistory: (o.status_history || []).map((h) => ({
      id: h.id,
      from: h.from,
      to: h.to,
      toCode: h.to_code,
      at: h.created_at
        ? new Date(h.created_at).toLocaleString("ru-RU")
        : "—",
    })),
    documents: (o.documents || []).map((d) => ({
      id: d.id,
      title: d.title,
      type: d.type,
      typeName: d.type_name,
      downloadUrl: d.download_url || "",
    })),
  };
}

export async function downloadAccountDocument(url: string, filename: string): Promise<void> {
  if (!url) return;
  const token = getAuthToken();
  const cartToken = getCartToken();
  const headers = new Headers({ Accept: "*/*" });
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (cartToken) headers.set("X-Cart-Token", cartToken);
  // Backend serves documents by relative path (/api/v1/...); resolve against API origin.
  const absolute = /^https?:\/\//i.test(url) ? url : `${API_BASE}${url.startsWith("/") ? url : `/${url}`}`;
  const res = await fetch(absolute, { headers });
  if (!res.ok) throw new StorefrontApiError("Не удалось скачать документ", res.status);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename.replace(/\s+/g, "_");
  a.click();
  URL.revokeObjectURL(href);
}

/* ── Saved builds (account) ──────────────────────────────── */

export type ApiSavedBuild = {
  id: string;
  number?: string;
  name: string;
  parent_product_id?: string;
  parent_product?: {
    id: string;
    sku?: string;
    slug?: string;
    name?: string;
    is_configurable?: boolean;
  } | null;
  selections?: Array<{ slot_id: string; product_id: string; qty: number }>;
  total_display?: number;
  total_amount?: number | string;
  currency?: string;
  is_valid?: boolean;
  validation_errors?: string[];
  is_public?: boolean;
  share_token?: string | null;
  share_path?: string | null;
  created_at?: string;
  updated_at?: string;
};

export async function apiListBuilds(params?: {
  page?: number;
  per_page?: number;
}): Promise<{ list: ApiSavedBuild[]; total: number }> {
  const qs = new URLSearchParams();
  qs.set("per_page", String(params?.per_page ?? 50));
  if (params?.page) qs.set("page", String(params.page));
  const res = await request<{
    data: ApiSavedBuild[];
    meta?: { total?: number };
  }>(`/account/builds?${qs}`);
  const list = res.data || [];
  return { list, total: Number(res.meta?.total ?? list.length) };
}

export async function apiCreateBuild(body: {
  name?: string;
  parent_product_id: string;
  selections: Array<{ slot_id: string; product_id: string; qty: number }>;
}): Promise<ApiSavedBuild> {
  const res = await request<ApiItem<ApiSavedBuild>>("/account/builds", {
    method: "POST",
    json: body,
  });
  return res.data;
}

export async function apiDeleteBuild(id: string): Promise<void> {
  await request(`/account/builds/${id}`, { method: "DELETE" });
}

export async function apiBuildToCart(id: string, qty = 1): Promise<unknown> {
  return request(`/account/builds/${id}/cart`, {
    method: "POST",
    json: { qty },
  });
}

/** Enable public share link for an owned account build. */
export async function apiEnableBuildShare(id: string): Promise<ApiSavedBuild> {
  const res = await request<ApiItem<ApiSavedBuild>>(`/account/builds/${id}/share`, {
    method: "POST",
  });
  return res.data;
}

/* ── Server cart (guest via X-Cart-Token, customer via Bearer) ── */

export type ServerCartItem = {
  id: string;
  product_id?: string | null;
  qty: number;
  price_kind?: string | null;
  build?: { selections?: Array<{ slot_id: string; product_id: string; qty: number }> } | null;
  available?: boolean;
  on_request?: boolean;
  product?: {
    id?: string;
    sku?: string | null;
    slug?: string | null;
    name?: string | null;
    on_request?: boolean;
    price_display?: number | null;
    price_compare_at_display?: number | null;
    on_sale?: boolean;
  } | null;
};

export type ServerCart = {
  id: string;
  guest_token?: string | null;
  promo_code?: string | null;
  bonus_to_spend?: number;
  items: ServerCartItem[];
  totals?: Record<string, unknown>;
};

export async function fetchServerCart(): Promise<ServerCart> {
  const res = await request<ApiItem<ServerCart>>("/cart");
  if (res.data?.guest_token) setCartToken(res.data.guest_token);
  return res.data;
}

export async function apiCartAddItem(body: {
  product_id: string;
  qty?: number;
  price_kind?: string;
  build?: { selections: Array<{ slot_id: string; product_id: string; qty: number }> };
}): Promise<ServerCart> {
  const res = await request<ApiItem<ServerCart>>("/cart/items", {
    method: "POST",
    json: body,
  });
  if (res.data?.guest_token) setCartToken(res.data.guest_token);
  return res.data;
}

export async function apiCartUpdateItem(
  id: string,
  body: { qty?: number },
): Promise<ServerCart> {
  const res = await request<ApiItem<ServerCart>>(`/cart/items/${encodeURIComponent(id)}`, {
    method: "PUT",
    json: body,
  });
  return res.data;
}

export async function apiCartRemoveItem(id: string): Promise<ServerCart> {
  const res = await request<ApiItem<ServerCart>>(`/cart/items/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  return res.data;
}

export async function apiCartSetWarranty(
  id: string,
  body: { term_id?: string | null; package_id?: string | null; option_id?: string | null },
): Promise<ServerCart> {
  const res = await request<ApiItem<ServerCart>>(
    `/cart/items/${encodeURIComponent(id)}/warranty`,
    { method: "PUT", json: body },
  );
  return res.data;
}

export async function apiCartSetPromo(promoCode: string | null): Promise<ServerCart> {
  const res = await request<ApiItem<ServerCart>>("/cart/promo", {
    method: "PUT",
    json: { promo_code: promoCode },
  });
  return res.data;
}

/** Replace the server cart with local UX state before cart-based checkout. */
export async function syncLocalCartToServer(
  lines: CartLine[],
  promoCode?: string | null,
): Promise<ServerCart> {
  for (const line of lines) {
    if (line.warranty?.isPaid && (!line.warranty.termId || !line.warranty.packageId)) {
      throw new Error(`Не удалось синхронизировать гарантию для товара «${line.product.title}»`);
    }
  }

  let serverCart = await fetchServerCart();
  for (const item of serverCart.items) {
    serverCart = await apiCartRemoveItem(item.id);
  }

  for (const line of lines) {
    const productId = await resolveCartLineProductId(line.product);
    if (!productId) {
      throw new Error(
        `Товар «${line.product.title}» не найден в API (slug: ${line.product.slug}). Сидеры: StorefrontDemoProductsSeeder + ConfigurableProductSeeder`,
      );
    }

    serverCart = await apiCartAddItem({
      product_id: productId,
      qty: line.qty,
      price_kind: line.priceKind ?? (line.build ? "configurator" : "price"),
      ...(line.build ? { build: line.build } : {}),
    });

    const parent = [...serverCart.items]
      .reverse()
      .find(
        (item) =>
          item.product_id === productId &&
          item.price_kind !== "warranty" &&
          JSON.stringify(item.build ?? null) === JSON.stringify(line.build ?? null),
      );
    if (!parent) {
      throw new Error(`Не удалось определить серверную позицию для товара «${line.product.title}»`);
    }

    if (line.warranty?.isPaid) {
      serverCart = await apiCartSetWarranty(parent.id, {
        term_id: line.warranty.termId,
        package_id: line.warranty.packageId,
      });
    }
  }

  serverCart = await apiCartSetPromo(promoCode?.trim() || null);
  return fetchServerCart();
}

export async function apiCartSetBonus(bonusToSpend: number): Promise<ServerCart> {
  const res = await request<ApiItem<ServerCart>>("/cart/bonus", {
    method: "PUT",
    json: { bonus_to_spend: bonusToSpend },
  });
  return res.data;
}

export async function apiCartPreview(): Promise<Record<string, unknown>> {
  const res = await request<ApiItem<Record<string, unknown>>>("/cart/preview", {
    method: "POST",
    json: {},
  });
  return res.data ?? {};
}

export async function apiValidatePromoCode(
  code: string,
  amountAfterGroup: number,
): Promise<{ type?: string; value?: string; discount?: number }> {
  const res = await request<
    ApiItem<{ type?: string; value?: string; discount?: number }>
  >("/promo-codes/validate", {
    method: "POST",
    json: { code, amount_after_group: amountAfterGroup },
  });
  return res.data ?? {};
}

export async function apiCheckoutPreview(
  payload: CheckoutPayload,
): Promise<Record<string, unknown>> {
  const res = await request<ApiItem<Record<string, unknown>>>("/checkout/preview", {
    method: "POST",
    json: payload,
  });
  return res.data ?? {};
}

/** Файл реквизитов покупателя для счёта (как в ЛК). */
export async function uploadOrderRequisites(
  orderId: string,
  form: FormData,
): Promise<Record<string, unknown>> {
  const res = await request<ApiItem<Record<string, unknown>>>(
    `/account/orders/${encodeURIComponent(orderId)}/documents`,
    { method: "POST", body: form },
  );
  return (res.data ?? {}) as Record<string, unknown>;
}

export async function apiQuoteWarranty(
  idOrSlug: string,
  body: {
    term_id?: string | null;
    package_id?: string | null;
    build?: { selections: Array<{ slot_id: string; product_id: string; qty: number }> } | null;
  },
): Promise<Record<string, unknown>> {
  const res = await request<ApiItem<Record<string, unknown>>>(
    `/products/${encodeURIComponent(idOrSlug)}/warranty-quote`,
    { method: "POST", json: body },
  );
  return res.data ?? {};
}

export async function apiFetchBonusBalance(): Promise<{
  balance: number;
  lifetime_earned?: number;
  lifetime_spent?: number;
}> {
  const res = await request<
    ApiItem<{ balance?: number; lifetime_earned?: number; lifetime_spent?: number }>
  >("/account/bonuses");
  return {
    balance: Number(res.data?.balance ?? 0),
    lifetime_earned: Number(res.data?.lifetime_earned ?? 0),
    lifetime_spent: Number(res.data?.lifetime_spent ?? 0),
  };
}

export async function apiFetchBonusHistory(params?: {
  page?: number;
  per_page?: number;
}): Promise<{ items: Record<string, unknown>[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.per_page) qs.set("per_page", String(params.per_page));
  const suffix = qs.toString() ? `?${qs}` : "";
  const res = await request<ApiItem<Record<string, unknown>[]>>(
    `/account/bonuses/history${suffix}`,
  );
  const items = Array.isArray(res.data) ? res.data : [];
  return { items, total: Number(res.meta?.total ?? items.length) };
}

export type BonusPreview = {
  balance: number;
  maxSpendablePoints: number;
  earnPreviewPoints: number;
  spendMaxPercent: number | null;
  spendMinOrderAmount: number | null;
  earnPercent: number | null;
};

/** Серверные лимиты бонусов из группы покупателя (источник правды). */
export async function apiPreviewBonusSpend(
  orderSubtotal: number,
  bonusToSpend?: number,
): Promise<BonusPreview> {
  const res = await request<
    ApiItem<{
      balance?: number;
      max_spendable_points?: number;
      earn_preview_points?: number;
      group?: {
        bonus_spend_max_percent?: number;
        bonus_spend_min_order_amount?: number | null;
        bonus_earn_percent?: number;
      } | null;
    }>
  >("/account/bonuses/preview", {
    method: "POST",
    json: { order_subtotal: orderSubtotal, bonus_to_spend: bonusToSpend ?? 0 },
  });
  const d = res.data ?? {};
  // Без округления вниз: сервер отдаёт баллы с копейками (round до 2 знаков),
  // floor здесь превращал бы всё меньше 1 балла в «начислим 0».
  return {
    balance: Number(d.balance ?? 0),
    maxSpendablePoints: Math.max(0, Number(d.max_spendable_points ?? 0)),
    earnPreviewPoints: Math.max(0, Number(d.earn_preview_points ?? 0)),
    spendMaxPercent: d.group?.bonus_spend_max_percent ?? null,
    spendMinOrderAmount: d.group?.bonus_spend_min_order_amount ?? null,
    earnPercent: d.group?.bonus_earn_percent ?? null,
  };
}

export async function apiFetchAccountDocuments(
  orderId: string,
): Promise<Record<string, unknown>[]> {
  const res = await request<ApiItem<Record<string, unknown>[]>>(
    `/account/orders/${encodeURIComponent(orderId)}/documents`,
  );
  return Array.isArray(res.data) ? res.data : [];
}

export async function apiFetchCurrencies(): Promise<
  Array<{ code: string; name?: string; symbol?: string }>
> {
  const res = await request<
    ApiItem<Array<{ code: string; name?: string; symbol?: string }>>
  >("/currencies");
  return res.data || [];
}

export async function apiFetchBanners(): Promise<Record<string, unknown>[]> {
  const res = await request<ApiItem<Record<string, unknown>[]>>("/banners");
  return Array.isArray(res.data) ? res.data : [];
}

export async function apiFetchBlogCategories(): Promise<Record<string, unknown>[]> {
  const res = await request<ApiItem<Record<string, unknown>[]>>("/blog-categories");
  return Array.isArray(res.data) ? res.data : [];
}

export async function apiFetchCategoryIcons(): Promise<Record<string, unknown>> {
  const res = await request<ApiItem<Record<string, unknown>>>("/meta/category-icons");
  return res.data ?? {};
}

export async function apiSuggestDellinAddress(q: string): Promise<Record<string, unknown>[]> {
  const res = await request<ApiItem<Record<string, unknown>[]>>(
    `/shipping/dellin/suggest-address?q=${encodeURIComponent(q)}`,
  );
  return Array.isArray(res.data) ? res.data : [];
}

export async function apiUpdateAccountBuild(
  id: string,
  body: Record<string, unknown>,
): Promise<ApiSavedBuild> {
  const res = await request<ApiItem<ApiSavedBuild>>(`/account/builds/${id}`, {
    method: "PUT",
    json: body,
  });
  return res.data;
}

/**
 * Guest/auth: snapshot current config as public shared build (no login required).
 * Returns share_token / share_path for storefront `/build/{token}`.
 */
export async function apiCreatePublicShareBuild(body: {
  name?: string;
  parent_product_id: string;
  selections: Array<{ slot_id: string; product_id: string; qty: number }>;
}): Promise<ApiSavedBuild> {
  const res = await request<ApiItem<ApiSavedBuild>>("/builds/share", {
    method: "POST",
    json: body,
    auth: true, // attach token if present; still works as guest
  });
  return res.data;
}

/** Public open by share token (no auth). */
export async function apiFetchSharedBuild(token: string): Promise<ApiSavedBuild> {
  const res = await request<ApiItem<ApiSavedBuild>>(`/builds/shared/${encodeURIComponent(token)}`, {
    auth: false,
  });
  return res.data;
}

export function storefrontShareUrl(sharePathOrToken: string): string {
  const path = sharePathOrToken.startsWith("/")
    ? sharePathOrToken
    : `/build/${sharePathOrToken}`;
  if (typeof window !== "undefined") {
    return `${window.location.origin}${path}`;
  }
  return path;
}

/**
 * Resolve cart line to backend product_id.
 * Supports: UUID id, catalog slug, configurator cfg-platform-*, cfg-opt-*.
 */
export async function resolveCartLineProductId(product: {
  id: string;
  slug: string;
}): Promise<string | null> {
  // Already a backend UUID
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      product.id,
    )
  ) {
    return product.id;
  }
  if (product.slug) {
    const bySlug = await fetchProductIdBySlug(product.slug);
    if (bySlug) return bySlug;
  }
  return null;
}

/** POST /newsletter/subscribe — footer «Новости и акции» form (auth optional). */
export async function apiSubscribeNewsletter(email: string): Promise<{ message: string }> {
  const res = await request<ApiItem<{ status: string; message?: string }>>(
    "/newsletter/subscribe",
    {
      method: "POST",
      json: { email, source: "footer" },
      auth: true, // attach token if the customer is logged in; works for guests too
    },
  );
  return { message: res.data?.message || "Вы подписаны на новости и акции." };
}

/** POST /newsletter/unsubscribe — by email + token from the letter's link. */
export async function apiUnsubscribeNewsletter(
  email: string,
  token: string,
): Promise<{ message: string }> {
  const res = await request<ApiItem<{ status: string; message?: string }>>(
    "/newsletter/unsubscribe",
    {
      method: "POST",
      json: { email, token },
      auth: false,
    },
  );
  return { message: res.data?.message || "Вы отписаны от рассылки." };
}

/* ── Account book: saved delivery addresses ───────────── */

export type ApiAddress = {
  id: string;
  type?: string;
  label?: string | null;
  country_code?: string;
  region?: string | null;
  city: string;
  street?: string | null;
  house?: string | null;
  apartment?: string | null;
  postal_code?: string | null;
  full_name?: string | null;
  phone?: string | null;
  is_default: boolean;
};

export type ApiAddressBody = {
  label?: string | null;
  city: string;
  street?: string | null;
  apartment?: string | null;
  postal_code?: string | null;
  full_name?: string | null;
  phone?: string | null;
  is_default?: boolean;
};

export async function apiFetchAddresses(): Promise<ApiAddress[]> {
  const res = await request<ApiItem<ApiAddress[]>>("/account/addresses", { auth: true });
  return Array.isArray(res.data) ? res.data : [];
}

export async function apiCreateAddress(body: ApiAddressBody): Promise<ApiAddress> {
  const res = await request<ApiItem<ApiAddress>>("/account/addresses", {
    method: "POST",
    json: body,
    auth: true,
  });
  return res.data;
}

export async function apiUpdateAddress(id: string, body: Partial<ApiAddressBody>): Promise<ApiAddress> {
  const res = await request<ApiItem<ApiAddress>>(`/account/addresses/${encodeURIComponent(id)}`, {
    method: "PUT",
    json: body,
    auth: true,
  });
  return res.data;
}

export async function apiDeleteAddress(id: string): Promise<void> {
  await request(`/account/addresses/${encodeURIComponent(id)}`, { method: "DELETE", auth: true });
}

/* ── Account book: legal entities (B2B requisites) ────── */

export type ApiLegalEntity = {
  id: string;
  title: string;
  company_name: string;
  inn: string;
  kpp?: string | null;
  ogrn?: string | null;
  legal_address?: string | null;
  actual_address?: string | null;
  bank_name?: string | null;
  bik?: string | null;
  checking_account?: string | null;
  correspondent_account?: string | null;
  ceo_name?: string | null;
  vat_payer?: boolean;
  is_default: boolean;
};

export type ApiLegalEntityBody = {
  title: string;
  company_name: string;
  inn: string;
  kpp?: string | null;
  ogrn?: string | null;
  legal_address?: string | null;
  bank_name?: string | null;
  bik?: string | null;
  checking_account?: string | null;
  correspondent_account?: string | null;
  is_default?: boolean;
};

export async function apiFetchLegalEntities(): Promise<ApiLegalEntity[]> {
  const res = await request<ApiItem<ApiLegalEntity[]>>("/account/legal-entities", { auth: true });
  return Array.isArray(res.data) ? res.data : [];
}

export async function apiCreateLegalEntity(body: ApiLegalEntityBody): Promise<ApiLegalEntity> {
  const res = await request<ApiItem<ApiLegalEntity>>("/account/legal-entities", {
    method: "POST",
    json: body,
    auth: true,
  });
  return res.data;
}

export async function apiUpdateLegalEntity(
  id: string,
  body: Partial<ApiLegalEntityBody>,
): Promise<ApiLegalEntity> {
  const res = await request<ApiItem<ApiLegalEntity>>(`/account/legal-entities/${encodeURIComponent(id)}`, {
    method: "PUT",
    json: body,
    auth: true,
  });
  return res.data;
}

export async function apiDeleteLegalEntity(id: string): Promise<void> {
  await request(`/account/legal-entities/${encodeURIComponent(id)}`, { method: "DELETE", auth: true });
}
