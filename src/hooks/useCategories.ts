"use client";

import { useEffect, useState } from "react";
import type { Category } from "@/data/types";
import { fetchCategories } from "@/lib/api";

let cache: Category[] | null = null;
let inflight: Promise<Category[]> | null = null;

/**
 * Засеять кэш SSR-данными до первого рендера клиентских хуков: страница
 * (app/catalog, app/product, app/page) передаёт дерево из серверной сборки —
 * крошки/H1/плитки не мигают в «корневое» состояние и остаются корректными,
 * даже если клиентский fetch категорий ещё не вернулся (или упал).
 */
export function seedCategories(cats: Category[] | null | undefined): void {
  if (cats && cats.length && !cache) cache = cats;
}

export async function loadCategories(force = false): Promise<Category[]> {
  // Пустой массив не кэшируем: сбой/пустой ответ не должны «запинить»
  // дерево до полной перезагрузки страницы.
  if (!force && cache && cache.length) return cache;
  if (!force && inflight) return inflight;
  inflight = fetchCategories(true)
    .then((cats) => {
      cache = cats.length ? cats : null;
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
