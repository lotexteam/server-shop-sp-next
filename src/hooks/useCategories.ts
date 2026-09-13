"use client";

import { useEffect, useState } from "react";
import type { Category } from "@/data/types";
import { fetchCategories } from "@/lib/api";

let cache: Category[] | null = null;
let inflight: Promise<Category[]> | null = null;

export async function loadCategories(force = false): Promise<Category[]> {
  if (!force && cache) return cache;
  if (!force && inflight) return inflight;
  inflight = fetchCategories(true)
    .then((cats) => {
      cache = cats;
      return cats;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cats = await loadCategories();
        if (!cancelled) {
          setCategories(cats);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Не удалось загрузить категории");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { categories, loading, error };
}
