import type { CommerceMethod } from "@/lib/api";

export type DeliveryTariff = {
  price: number;
  categorySlugs: string[];
  label?: string;
};

export type DeliveryQuote = {
  methodCode: string;
  price: number;
  free: boolean;
  available: boolean;
  note: string;
};

function tariffsFromConfig(method: CommerceMethod): DeliveryTariff[] {
  const raw = method.config?.tariffs;
  if (!Array.isArray(raw)) return [];
  return raw.map((t) => {
    const row = t as Record<string, unknown>;
    const slugs = Array.isArray(row.categorySlugs)
      ? (row.categorySlugs as string[])
      : Array.isArray(row.category_slugs)
        ? (row.category_slugs as string[])
        : [];
    return {
      price: Number(row.price) || 0,
      categorySlugs: slugs,
      label: row.label ? String(row.label) : undefined,
    };
  });
}

export function quoteDeliveryMethod(
  method: CommerceMethod,
  cartSlugs: string[],
  cartSubtotal: number,
): DeliveryQuote {
  const driver = method.driver || "manual";
  const tariffs = tariffsFromConfig(method);
  const freeFrom = Number(method.config?.freeFrom ?? 0) || 0;

  if (driver === "dellin") {
    return {
      methodCode: method.code,
      price: 0,
      free: false,
      available: true,
      note: method.config?.payer_label || "Расчёт ТК",
    };
  }

  if (driver === "pickup" && tariffs.length === 0) {
    return {
      methodCode: method.code,
      price: 0,
      free: true,
      available: true,
      note: "Бесплатно",
    };
  }

  const matched = tariffs.filter((t) => {
    if (t.categorySlugs.length) {
      if (!cartSlugs.length) return false;
      // cartSlugs включают предков (shipping_category_slugs): тариф на основную
      // категорию покрывает все сабы.
      if (!t.categorySlugs.some((s) => cartSlugs.includes(s))) return false;
    }
    return true;
  });
  // Два тарифа в корзине → 1 дорогая. Категории нет в матрице → минимальный.
  let price = 0;
  if (matched.length) price = Math.max(...matched.map((t) => t.price));
  else if (tariffs.length) price = Math.min(...tariffs.map((t) => t.price));
  const free = freeFrom > 0 && cartSubtotal >= freeFrom;
  const final = free ? 0 : price;

  return {
    methodCode: method.code,
    price: final,
    free,
    available: true,
    note: free
      ? `Бесплатно от ${freeFrom.toLocaleString("ru-RU")} ₽`
      : final === 0
        ? "Бесплатно"
        : "",
  };
}

export function estimateShippingFromMethods(
  methods: CommerceMethod[],
  cartSlugs: string[],
  cartSubtotal: number,
): { price: number; label: string; free: boolean } {
  const quotes = methods
    .filter((m) => m.driver !== "dellin")
    .map((m) => quoteDeliveryMethod(m, cartSlugs, cartSubtotal));
  if (!quotes.length) return { price: 0, label: "на оформлении", free: true };
  const min = Math.min(...quotes.map((q) => q.price));
  return {
    price: min,
    label: min === 0 ? "Бесплатно" : `от ${min.toLocaleString("ru-RU")} ₽`,
    free: min === 0,
  };
}

export type DeliveryGroup = {
  /** slug категории доставки */
  key: string;
  title: string;
  methods: CommerceMethod[];
  sort: number;
};

const sortByOrder = (a: CommerceMethod, b: CommerceMethod) =>
  Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0);

/**
 * Категория доставки — визуальная группа типов на витрине.
 * Типы без категории остаются отдельными пунктами (ungrouped).
 * Сортировка групп и типов — одно поле sort_order.
 */
export function groupDeliveryMethods(
  methods: CommerceMethod[],
): { groups: DeliveryGroup[]; ungrouped: CommerceMethod[] } {
  const byKey = new Map<string, CommerceMethod[]>();
  const ungrouped: CommerceMethod[] = [];
  for (const m of methods) {
    const key = m.delivery_category?.slug || "";
    if (!key) {
      ungrouped.push(m);
      continue;
    }
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(m);
  }
  ungrouped.sort(sortByOrder);
  const groups: DeliveryGroup[] = [];
  for (const [key, list] of byKey) {
    list.sort(sortByOrder);
    groups.push({
      key,
      title: list[0]?.delivery_category?.name || key,
      methods: list,
      sort: Number(
        list[0]?.delivery_category?.sort_order ?? list[0]?.sort_order ?? 0,
      ),
    });
  }
  groups.sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title, "ru"));
  return { groups, ungrouped };
}
