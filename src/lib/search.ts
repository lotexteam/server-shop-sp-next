import type { Product, Category } from "@/data/types";
import { loadCategories } from "@/hooks/useCategories";
import {
  searchProductsApi,
  searchSuggestApi,
  type SuggestionProduct,
} from "@/lib/api";

export type { SuggestionProduct };

export type SearchHit =
  | { kind: "product"; product: Product; score: number }
  | { kind: "category"; category: Category; score: number };

function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s+.\-_/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(q: string) {
  return normalize(q).split(" ").filter(Boolean);
}

/** Score how well haystack matches query tokens (higher = better). */
function scoreText(haystack: string, queryTokens: string[]): number {
  const h = normalize(haystack);
  if (!h || !queryTokens.length) return 0;
  let score = 0;
  for (const t of queryTokens) {
    if (!t) continue;
    if (h === t) score += 100;
    else if (h.startsWith(t)) score += 60;
    else if (h.includes(` ${t}`)) score += 40;
    else if (h.includes(t)) score += 25;
    else return 0;
  }
  return score;
}

function scoreProduct(
  product: Product,
  queryTokens: string[],
  categoryBySlug: Record<string, Category>,
): number {
  const catTitle =
    product.categoryTitle ||
    categoryBySlug[product.category]?.title ||
    "";
  const specText = (product.specs ?? []).map((s) => `${s.label} ${s.value}`).join(" ");
  const fields = [
    product.title,
    product.shortName ?? "",
    product.brand,
    catTitle,
    product.slug,
    product.sku ?? "",
    specText,
    product.shortDescription ?? "",
    ...(product.badges ?? []),
  ];
  let score = scoreFields(fields, queryTokens);
  const sku = normalize(product.sku ?? "");
  const slug = normalize(product.slug);
  if (sku && queryTokens.some((t) => sku === t || sku.includes(t))) score += 80;
  if (slug && queryTokens.some((t) => slug === t)) score += 40;
  return score;
}

function scoreFields(fields: string[], queryTokens: string[]): number {
  const blob = normalize(fields.join(" "));
  for (const t of queryTokens) {
    if (!blob.includes(t)) return 0;
  }
  let total = 0;
  for (const f of fields) {
    total += scoreText(f, queryTokens);
  }
  if (fields[0]) {
    const title = normalize(fields[0]);
    if (queryTokens.every((t) => title.includes(t))) total += 30;
  }
  return total;
}

export function searchCatalogIn(
  query: string,
  products: Product[],
  categories: Category[],
  limits = { products: 6, categories: 4 },
  guaranteed?: ReadonlySet<string>,
  preserveProductOrder = false,
): SearchHit[] {
  const q = query.trim();
  if (q.length < 1) return [];
  const toks = tokens(q);
  if (!toks.length) return [];

  const categoryBySlug = Object.fromEntries(categories.map((c) => [c.slug, c]));

  const catHits: Array<Extract<SearchHit, { kind: "category" }>> = [];
  for (const category of categories) {
    const score = scoreFields(
      [category.title, category.description ?? "", category.slug],
      toks,
    );
    if (score > 0) catHits.push({ kind: "category", category, score });
  }
  catHits.sort((a, b) =>
    (a.category.searchRank ?? Number.MAX_SAFE_INTEGER) -
      (b.category.searchRank ?? Number.MAX_SAFE_INTEGER) ||
    b.score - a.score ||
    a.category.title.localeCompare(b.category.title),
  );

  const prodHits: SearchHit[] = [];
  for (const product of products) {
    let score = scoreProduct(product, toks, categoryBySlug);
    // Серверный поиск уже учёл атрибуты/релевантность — не выбрасываем
    // его находки только потому, что клиентская эвристика их не видит.
    if (score === 0 && guaranteed?.has(product.id)) score = 1;
    if (score > 0) prodHits.push({ kind: "product", product, score });
  }
  // The server has already ranked these hits (including category search_rank).
  if (!preserveProductOrder) prodHits.sort((a, b) => b.score - a.score);

  return [
    ...catHits.slice(0, limits.categories),
    ...prodHits.slice(0, limits.products),
  ];
}

/** Async search over API-backed catalog cache. */
export type CategoryHit = { category: Category; score: number };

export type SuggestionResult = {
  categories: CategoryHit[];
  products: SuggestionProduct[];
  /** Поправленный запрос («возможно, вы имели в виду»), если сервер его вернул. */
  corrected: string | null;
};

/**
 * Недавние запросы пользователя — только на клиенте (localStorage), без
 * аналитики и без отправки содержимого на сервер. Храним последние 5.
 */
const RECENT_KEY = "storefront:recent-searches";
const RECENT_LIMIT = 5;

export function loadRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string" && v.trim().length > 0).slice(0, RECENT_LIMIT)
      : [];
  } catch {
    return [];
  }
}

export function rememberRecentSearch(query: string): void {
  const q = query.trim();
  if (typeof window === "undefined" || q.length < MIN_SEARCH_CHARS) return;
  try {
    const next = [q, ...loadRecentSearches().filter((v) => v.toLowerCase() !== q.toLowerCase())].slice(
      0,
      RECENT_LIMIT,
    );
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* приватный режим — не критично */
  }
}

/** Минимум символов: один символ даёт мусор и лишние запросы. */
export const MIN_SEARCH_CHARS = 2;

/** Категории ищутся локально по уже загруженному дереву — без запроса к API. */
export function matchCategories(
  query: string,
  categories: Category[],
  limit = 4,
): CategoryHit[] {
  const toks = tokens(query);
  if (!toks.length) return [];

  const hits: CategoryHit[] = [];
  for (const category of categories) {
    const score = scoreFields(
      [category.title, category.description ?? "", category.slug],
      toks,
    );
    if (score > 0) hits.push({ category, score });
  }

  return hits
    .sort(
      (a, b) =>
        (a.category.searchRank ?? Number.MAX_SAFE_INTEGER) -
          (b.category.searchRank ?? Number.MAX_SAFE_INTEGER) ||
        b.score - a.score ||
        a.category.title.localeCompare(b.category.title),
    )
    .slice(0, limit);
}

/**
 * Подсказки для автокомплита: товары — с сервера (лёгкий эндпоинт /search/suggest),
 * категории — из уже загруженного дерева. Запрос отменяется через AbortSignal.
 */
export async function searchSuggestions(
  query: string,
  limits = { products: 8, categories: 4 },
  signal?: AbortSignal,
): Promise<SuggestionResult> {
  const q = query.trim();
  if (q.length < MIN_SEARCH_CHARS) return { categories: [], products: [], corrected: null };

  const [categories, products] = await Promise.all([
    loadCategories().catch(() => [] as Category[]),
    suggestProducts(q, limits.products, signal),
  ]);

  return {
    categories: matchCategories(q, categories, limits.categories),
    products,
    corrected: null,
  };
}

async function suggestProducts(
  q: string,
  limit: number,
  signal?: AbortSignal,
): Promise<SuggestionProduct[]> {
  try {
    return await searchSuggestApi(q, limit, signal);
  } catch (error) {
    // Отменённый запрос — это не ошибка, и фолбэк тоже не нужен.
    if (signal?.aborted) throw error;
    // API без /search/suggest (старый релиз): работаем через полный поиск.
    try {
      const products = await searchProductsApi(q);
      return products.slice(0, limit).map(toSuggestion);
    } catch {
      return [];
    }
  }
}

function toSuggestion(product: Product): SuggestionProduct {
  return {
    id: product.id,
    slug: product.slug,
    urlPath: `/product/${product.slug}`,
    title: product.title,
    sku: product.sku ?? null,
    brand: product.brand ?? null,
    categoryTitle: product.categoryTitle ?? null,
    image: product.image ?? null,
    price: product.price ?? null,
    onRequest: product.onRequest === true,
  };
}

export type HighlightSegment = { text: string; match: boolean };

/** Разбивает строку на подсвеченные/обычные куски по токенам запроса. */
export function highlightSegments(text: string, query: string): HighlightSegment[] {
  const needles = tokens(query).filter((t) => t.length >= 2);
  if (!text || !needles.length) return [{ text, match: false }];

  const haystack = text.toLowerCase();
  const ranges: Array<[number, number]> = [];
  for (const needle of needles) {
    let from = 0;
    while (from < haystack.length) {
      const at = haystack.indexOf(needle, from);
      if (at === -1) break;
      ranges.push([at, at + needle.length]);
      from = at + needle.length;
    }
  }
  if (!ranges.length) return [{ text, match: false }];

  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([range[0], range[1]]);
  }

  const out: HighlightSegment[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) out.push({ text: text.slice(cursor, start), match: false });
    out.push({ text: text.slice(start, end), match: true });
    cursor = end;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), match: false });

  return out;
}

export function filterProductsByQuery(
  list: Product[],
  query: string,
  categories: Category[] = [],
): Product[] {
  const q = query.trim();
  if (!q) return list;
  const toks = tokens(q);
  if (!toks.length) return list;

  const categoryBySlug = Object.fromEntries(categories.map((c) => [c.slug, c]));

  return list
    .map((product) => ({
      product,
      score: scoreProduct(product, toks, categoryBySlug),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.product);
}
