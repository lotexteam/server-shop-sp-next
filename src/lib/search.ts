import type { Product, Category } from "@/data/types";
import { loadCategories } from "@/hooks/useCategories";
import { fetchProducts, searchProductsApi } from "@/lib/api";

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
): SearchHit[] {
  const q = query.trim();
  if (q.length < 1) return [];
  const toks = tokens(q);
  if (!toks.length) return [];

  const categoryBySlug = Object.fromEntries(categories.map((c) => [c.slug, c]));

  const catHits: SearchHit[] = [];
  for (const category of categories) {
    const score = scoreFields(
      [category.title, category.description ?? "", category.slug],
      toks,
    );
    if (score > 0) catHits.push({ kind: "category", category, score });
  }
  catHits.sort((a, b) => b.score - a.score);

  const prodHits: SearchHit[] = [];
  for (const product of products) {
    let score = scoreProduct(product, toks, categoryBySlug);
    // Серверный поиск уже учёл атрибуты/релевантность — не выбрасываем
    // его находки только потому, что клиентская эвристика их не видит.
    if (score === 0 && guaranteed?.has(product.id)) score = 1;
    if (score > 0) prodHits.push({ kind: "product", product, score });
  }
  prodHits.sort((a, b) => b.score - a.score);

  return [
    ...catHits.slice(0, limits.categories),
    ...prodHits.slice(0, limits.products),
  ];
}

/** Async search over API-backed catalog cache. */
export async function searchCatalog(
  query: string,
  limits = { products: 6, categories: 4 },
): Promise<SearchHit[]> {
  const q = query.trim();
  const [categories, api] = await Promise.all([
    loadCategories(),
    q
      ? (async () => {
          try {
            // Основной путь: серверный поиск на бэке (GET /search)
            return { items: await searchProductsApi(q) };
          } catch {
            // Фолбэк: SQL-поиск по токенам
            return await fetchProducts({ q, per_page: 50 }).catch(
              () => ({ items: [] as Product[] }),
            );
          }
        })()
      : Promise.resolve({ items: [] as Product[] }),
  ]);
  return searchCatalogIn(
    query,
    api.items,
    categories,
    limits,
    new Set(api.items.map((p) => p.id)),
  );
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
