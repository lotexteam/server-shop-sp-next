"use client";

import { useEffect, useState } from "react";
import { fetchMenu, type MenuData, type MenuNavItem } from "@/lib/api";

const cache = new Map<string, MenuData>();
const inflight = new Map<string, Promise<MenuData>>();

export async function loadMenu(code: string, force = false): Promise<MenuData> {
  if (!force && cache.has(code)) return cache.get(code)!;
  if (!force && inflight.has(code)) return inflight.get(code)!;
  const p = fetchMenu(code)
    .then((data) => {
      cache.set(code, data);
      return data;
    })
    .finally(() => {
      inflight.delete(code);
    });
  inflight.set(code, p);
  return p;
}

export function useMenu(code: string) {
  const [data, setData] = useState<MenuData>(
    cache.get(code) ?? { items: [], subcategoriesDepth: null },
  );
  const [loading, setLoading] = useState(!cache.has(code));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const menu = await loadMenu(code);
        if (!cancelled) {
          // Empty CMS menu = hide items, do not show mock labels
          setData(menu);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Ошибка меню");
          setData({ items: [], subcategoriesDepth: null });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  const items: MenuNavItem[] = data.items;
  return { items, subcategoriesDepth: data.subcategoriesDepth, loading, error };
}
