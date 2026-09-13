"use client";

import type { Product } from "@/data/types";
import { useShop, MAX_COMPARE } from "@/store/shop";
import { useToast } from "@/components/ui/toast";

/** Shared compare toggle + toast feedback. */
export function useCompareAction() {
  const { toggleCompare, isInCompare, compare } = useShop();
  const { push } = useToast();

  const onToggleCompare = (product: Product) => {
    const result = toggleCompare(product);
    if (!result.ok) {
      push({
        variant: "warning",
        title: "Лимит сравнения",
        description: `Можно сравнить не более ${result.max} товаров. Уберите один из списка.`,
      });
      return;
    }
    if (result.action === "added") {
      push({
        variant: "success",
        title: "Добавлено к сравнению",
        description:
          result.count < 2
            ? `${product.title} · добавьте ещё минимум 1 товар`
            : `${product.title} · ${result.count} из ${MAX_COMPARE}`,
      });
    } else {
      push({
        variant: "info",
        title: "Убрано из сравнения",
        description: product.title,
      });
    }
  };

  return { onToggleCompare, isInCompare, compareCount: compare.length, MAX_COMPARE };
}
