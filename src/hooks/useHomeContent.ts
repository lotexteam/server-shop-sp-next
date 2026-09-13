"use client";

import { useEffect, useState } from "react";
import { fetchHomeContent, type HomeContent } from "@/lib/api";

let cache: HomeContent | null = null;
let inflight: Promise<HomeContent> | null = null;

export async function loadHomeContent(force = false): Promise<HomeContent> {
  if (!force && cache) return cache;
  if (!force && inflight) return inflight;
  inflight = fetchHomeContent()
    .then((c) => {
      cache = c;
      return c;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useHomeContent() {
  const [content, setContent] = useState<HomeContent | null>(cache);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let cancelled = false;
    void loadHomeContent().then((c) => {
      if (!cancelled) {
        setContent(c);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { content, loading };
}
