"use client";

import { useEffect, useState } from "react";
import {
  fetchWarrantyOptions,
  type WarrantyOption,
} from "@/lib/api";

export function useWarrantyOptions(
  productKey: string | undefined,
  build?: { selections: Array<{ slot_id: string; product_id: string; qty: number }> } | null,
) {
  const [options, setOptions] = useState<WarrantyOption[]>([]);
  const [loading, setLoading] = useState(false);
  const buildKey = build?.selections?.length
    ? JSON.stringify(build.selections)
    : "";

  useEffect(() => {
    if (!productKey) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = window.setTimeout(() => {
      void fetchWarrantyOptions(
        productKey,
        buildKey ? { selections: JSON.parse(buildKey) } : null,
      ).then((list) => {
        if (!cancelled) {
          setOptions(list);
          setLoading(false);
        }
      });
    }, buildKey ? 280 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [productKey, buildKey]);

  return { options, loading };
}
