"use client";

import { useEffect, useState } from "react";
import { fetchMenu, type MenuNavItem } from "@/lib/api";

const cache = new Map<string, MenuNavItem[]>();
const inflight = new Map<string, Promise<MenuNavItem[]>>();

export async function loadMenu(code: string, force = false): Promise<MenuNavItem[]> {
  if (!force && cache.has(code)) return cache.get(code)!;
  if (!force && inflight.has(code)) return inflight.get(code)!;
  const p = fetchMenu(code)
    .then((items) => {
      cache.set(code, items);
      return items;
    })
    .finally(() => {
      inflight.delete(code);
    });
  inflight.set(code, p);
  return p;
}

export function useMenu(code: string) {
  const [items, setItems] = useState<MenuNavItem[]>(cache.get(code) ?? []);
  const [loading, setLoading] = useState(!cache.has(code));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await loadMenu(code);
        if (!cancelled) {
          // Empty CMS menu = hide items, do not show mock labels
          setItems(list);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Ошибка меню");
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  return { items, loading, error };
}
