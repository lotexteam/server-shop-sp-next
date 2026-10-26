"use client";

import { useEffect, useState } from "react";
import {
  fetchWarrantyOptions,
  type WarrantyOption,
} from "@/lib/api";

type WarrantyResult = {
  key: string;
  options: WarrantyOption[];
};

export function useWarrantyOptions(
  productKey: string | undefined,
  build?: { selections: Array<{ slot_id: string; product_id: string; qty: number }> } | null,
) {
  const buildKey = build?.selections?.length
    ? JSON.stringify(build.selections)
    : "";
  const requestKey = JSON.stringify([productKey ?? "", buildKey]);
  const [result, setResult] = useState<WarrantyResult | null>(null);
  const initialized = result?.key === requestKey;
  const options = initialized ? result.options : [];

  useEffect(() => {
    let cancelled = false;
    if (!productKey) {
      setResult({ key: requestKey, options: [] });
      return () => {
        cancelled = true;
      };
    }

    const timer = window.setTimeout(() => {
      void fetchWarrantyOptions(
        productKey,
        buildKey ? { selections: JSON.parse(buildKey) } : null,
      ).then((loadedOptions) => {
        if (!cancelled) {
          setResult({ key: requestKey, options: loadedOptions });
        }
      });
    }, buildKey ? 280 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [productKey, buildKey, requestKey]);

  return {
    options,
    loading: Boolean(productKey) && !initialized,
    initialized: Boolean(initialized),
  };
}
