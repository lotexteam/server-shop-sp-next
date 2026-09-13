"use client";

import { useEffect, useState } from "react";
import type { Product } from "@/data/types";
import { fetchProducts, fetchProduct } from "@/lib/api";

/**
 * Fetch every catalog page in parallel (instead of page-by-page).
 * The server caps per_page at 500.
 */
async function fetchAllCatalogPages(): Promise<Product[]> {
  const pageSize = 250;
  const first = await fetchProducts({ page: 1, per_page: pageSize });
  const all = [...first.items];
  const lastPage = Math.max(
    1,
    Number(first.lastPage) || Math.ceil((Number(first.total) || all.length) / pageSize) || 1,
  );
  if (lastPage > 1) {
    const rest = await Promise.all(
      Array.from({ length: lastPage - 1 }, (_, i) =>
        fetchProducts({ page: i + 2, per_page: pageSize }).catch(() => ({ items: [] as Product[] })),
      ),
    );
    for (const next of rest) all.push(...next.items);
  }
  return all;
}

let cache: Product[] | null = null;
let inflight: Promise<Product[]> | null = null;

/** Cached list of published catalog products (excludes pure cfg-opt-* when possible). */
export async function loadCatalogProducts(force = false): Promise<Product[]> {
  if (!force && cache) return cache;
  if (!force && inflight) return inflight;
  inflight = fetchAllCatalogPages()
    .then((resItems) => {
      // Prefer storefront catalog: hide zero-price builtin options unless platform
      const items = resItems.filter(
        (p) =>
          !p.slug.startsWith("cfg-opt-") ||
          (p.price != null && p.price > 0) ||
          p.onRequest ||
          p.slug.startsWith("cfg-platform-"),
      );
      cache = items.length ? items : resItems;
      return cache;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useCatalogProducts() {
  const [products, setProducts] = useState<Product[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const items = await loadCatalogProducts();
        if (!cancelled) {
          setProducts(items);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Не удалось загрузить товары");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { products, loading, error, reload: () => loadCatalogProducts(true) };
}

/* ── Home highlights ─────────────────────────────────────── */

let homeCache: Product[] | null = null;
let homeInflight: Promise<Product[]> | null = null;

/**
 * One small page for the home sections (hot deals / hits / bestsellers —
 * ~8 cards total). Avoids pulling the whole catalog on the landing page.
 */
export async function loadHomeHighlights(force = false): Promise<Product[]> {
  if (!force && homeCache) return homeCache;
  if (!force && homeInflight) return homeInflight;
  homeInflight = fetchProducts({ page: 1, per_page: 24 })
    .then(({ items }) => {
      homeCache = items.filter((p) => !p.slug.startsWith("cfg-opt-"));
      return homeCache;
    })
    .catch(() => {
      homeCache = [];
      return homeCache;
    })
    .finally(() => {
      homeInflight = null;
    });
  return homeInflight;
}

export function useHomeHighlights() {
  const [products, setProducts] = useState<Product[]>(homeCache ?? []);

  useEffect(() => {
    let cancelled = false;
    void loadHomeHighlights().then((items) => {
      if (!cancelled) setProducts(items);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return products;
}

/** Resolve product records by id or slug (favorites / compare). */
export async function resolveProductsByIds(ids: string[]): Promise<Product[]> {
  if (!ids.length) return [];
  // Full catalog is already in memory most of the time — prefer it over N requests.
  const known = await (cache ? Promise.resolve(cache) : loadCatalogProducts());
  const byKey = new Map<string, Product>();
  for (const p of known) {
    byKey.set(p.id, p);
    if (p.slug) byKey.set(p.slug, p);
    if (p.sku) byKey.set(p.sku, p);
  }
  const missing = [...new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))]
    .filter((key) => !byKey.has(key));
  if (missing.length) {
    const resolved = await Promise.all(missing.map((id) => fetchProduct(id)));
    for (const p of resolved) {
      if (!p) continue;
      byKey.set(p.id, p);
      if (p.slug) byKey.set(p.slug, p);
      if (p.sku) byKey.set(p.sku, p);
    }
  }
  return ids
    .map((id) => byKey.get(String(id || "").trim()))
    .filter((p): p is Product => Boolean(p));
}
