import type { Product } from "@/data/types";
import { CONDITION_LABEL } from "@/data/conditions";
import { formatPrice } from "@/lib/utils";

export type CompareRow = {
  key: string;
  label: string;
  values: string[];
  /** true if not all values are equal (ignoring empty) */
  differs: boolean;
  group: "main" | "specs";
};

function categoryTitle(p: Product) {
  return (p.categoryTitle || "").trim();
}

function allEqual(values: string[]) {
  const norm = values.map((v) => v.trim().toLowerCase());
  return norm.every((v) => v === norm[0]);
}

/** Build comparison matrix for selected products. */
export function buildCompareRows(items: Product[]): CompareRow[] {
  if (!items.length) return [];

  const hasBrand = items.some((p) => Boolean(p.brand?.trim()));
  const main: Omit<CompareRow, "differs">[] = [
    ...(hasBrand
      ? [
          {
            key: "brand",
            label: "Бренд",
            values: items.map((p) => p.brand?.trim() || "—"),
            group: "main" as const,
          },
        ]
      : []),
    {
      key: "category",
      label: "Категория",
      values: items.map((p) => categoryTitle(p) || "—"),
      group: "main",
    },
    {
      key: "price",
      label: "Цена",
      values: items.map((p) => (p.onRequest || p.price == null ? "Под заказ" : formatPrice(p.price))),
      group: "main",
    },
    {
      key: "oldPrice",
      label: "Старая цена",
      values: items.map((p) => (!p.onRequest && p.oldPrice ? formatPrice(p.oldPrice) : "—")),
      group: "main",
    },
    {
      key: "condition",
      label: "Состояние",
      values: items.map((p) => CONDITION_LABEL[p.condition]),
      group: "main",
    },
    {
      key: "stock",
      label: "Наличие",
      values: items.map((p) => (p.onRequest || p.price == null ? "Под заказ" : "Доступен к заказу")),
      group: "main",
    },
  ];

  // Union of all spec labels in order of first appearance
  const specLabels: string[] = [];
  for (const p of items) {
    for (const s of p.specs) {
      if (!specLabels.includes(s.label)) specLabels.push(s.label);
    }
  }

  const specs: Omit<CompareRow, "differs">[] = specLabels.map((label) => ({
    key: `spec:${label}`,
    label,
    values: items.map((p) => p.specs.find((s) => s.label === label)?.value ?? "—"),
    group: "specs" as const,
  }));

  return [...main, ...specs].map((row) => ({
    ...row,
    differs: !allEqual(row.values),
  }));
}

export function minPriceIndex(items: Product[]): number {
  if (!items.length) return -1;
  let min = -1;
  for (let i = 0; i < items.length; i++) {
    // «Под заказ» products have no comparable price
    if (items[i].onRequest) continue;
    const price = items[i].price;
    const minPrice = min === -1 ? null : items[min].price;
    if (price != null && (min === -1 || minPrice == null || price < minPrice)) min = i;
  }
  return min;
}
