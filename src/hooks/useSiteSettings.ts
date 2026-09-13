"use client";

import { useEffect, useState } from "react";
import { fetchSite, getCachedSite, type ShopSite } from "@/lib/api";

let cache: ShopSite | null = getCachedSite();
let inflight: Promise<ShopSite> | null = null;

export async function loadSiteSettings(force = false): Promise<ShopSite> {
  if (!force && cache) return cache;
  if (!force && inflight) return inflight;
  inflight = fetchSite()
    .then((s) => {
      cache = s;
      return s;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useSiteSettings() {
  const [site, setSite] = useState<ShopSite | null>(cache || getCachedSite());
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let cancelled = false;
    void loadSiteSettings().then((s) => {
      if (!cancelled) {
        setSite(s);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { site, loading };
}
