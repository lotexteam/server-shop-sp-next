/**
 * Yandex.Metrica module (counter + Ecommerce).
 *
 * Single entry for the storefront: pages/stores call one-line helpers,
 * no Metrica logic leaks into components. Config comes from
 * GET /api/v1/metrica/config; when disabled everything is a no-op.
 *
 * Event format: https://yandex.ru/support/metrica/ru/ecommerce/data.md
 * (container limit 8192 chars — big orders are split into sub-purchases).
 */

import { API_BASE } from "@/lib/api-base";

type MetricaConfig = {
  enabled: boolean;
  counter_id?: string;
  ecommerce?: boolean;
  container?: string;
  webvisor?: boolean;
  clickmap?: boolean;
  tracklinks?: boolean;
  trackhash?: boolean;
  accurate_track_bounce?: boolean;
  defer?: boolean;
};

/** productFieldObject (id or name required). */
export type MetricaProduct = {
  id: string;
  name: string;
  price?: number | null;
  brand?: string | null;
  /** Category hierarchy up to 5 levels, " / " separated. */
  category?: string | null;
  quantity?: number;
  coupon?: string;
  discount?: number;
  list?: string;
  position?: number;
  variant?: string;
};

export type PurchaseOrder = {
  id: string;
  total: number | string;
  coupon?: string | null;
  goal_id?: number | null;
};

let config: MetricaConfig | null = null;
let initStarted = false;

declare global {
  interface Window {
    dataLayer?: unknown[];
    ym?: (...args: unknown[]) => void;
  }
}

function containerName(): string {
  return config?.container || "dataLayer";
}

function container(): unknown[] {
  const w = window as unknown as Record<string, unknown[]>;
  const name = containerName();
  if (!Array.isArray(w[name])) w[name] = [];
  return w[name];
}

/** Load config from API and initialize the counter once per page lifetime. */
export async function initMetrica(): Promise<void> {
  if (initStarted) return;
  initStarted = true;
  try {
    const res = await fetch(`${API_BASE}/metrica/config`, { headers: { Accept: "application/json" } });
    config = res.ok ? ((await res.json()) as { data: MetricaConfig })?.data ?? { enabled: false } : { enabled: false };
  } catch {
    config = { enabled: false };
    return;
  }
  if (!config.enabled || !config.counter_id) return;

  // Ensure the data container exists before the tag loads.
  void container();

  // Standard tag.js loader.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const w = window as any;
  if (!w.ym) {
    w.ym = function (...args: unknown[]) {
      w.ym.a = w.ym.a || [];
      w.ym.a.push(args);
    };
    w.ym.l = Date.now();
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
  if (!document.querySelector(`script[src="https://mc.yandex.ru/metrika/tag.js"]`)) {
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://mc.yandex.ru/metrika/tag.js";
    document.head.appendChild(script);
  }

  const options: Record<string, unknown> = {
    clickmap: config.clickmap !== false,
    trackLinks: config.tracklinks !== false,
    accurateTrackBounce: config.accurate_track_bounce !== false,
    webvisor: config.webvisor !== false,
    defer: Boolean(config.defer),
  };
  if (config.ecommerce !== false) options.ecommerce = containerName();
  window.ym?.(Number(config.counter_id), "init", options);
}

/** Low-level push — kept public so new event kinds need no core changes. */
export function pushEcommerce(payload: Record<string, unknown>): void {
  if (!config?.enabled || config.ecommerce === false) return;
  container().push({ ecommerce: payload });
}

/* ── Ecommerce events ─────────────────────────────────────────── */

export function detail(product: MetricaProduct): void {
  pushEcommerce({ currencyCode: currency(), detail: { products: [product] } });
}

export function impressions(products: MetricaProduct[], list = "Каталог"): void {
  if (!products.length) return;
  pushEcommerce({
    currencyCode: currency(),
    impressions: products.map((p, i) => ({ list, position: i + 1, ...p })),
  });
}

export function click(product: MetricaProduct): void {
  pushEcommerce({ currencyCode: currency(), click: { products: [product] } });
}

export function addToCart(product: MetricaProduct): void {
  pushEcommerce({ currencyCode: currency(), add: { products: [product] } });
}

export function removeFromCart(product: MetricaProduct): void {
  pushEcommerce({ currencyCode: currency(), remove: { products: [product] } });
}

/**
 * Purchase on the order-success screen. Orders with a container over
 * 8192 chars are split into sub-orders ORDER#x-1, ORDER#x-2… (per docs).
 */
export function purchase(order: PurchaseOrder, products: MetricaProduct[]): void {
  const revenue = Number(order.total) || undefined;
  const actionField: Record<string, unknown> = { id: order.id };
  if (revenue != null) actionField.revenue = revenue;
  if (order.coupon) actionField.coupon = order.coupon;
  if (order.goal_id) actionField.goal_id = order.goal_id;

  const chunks: MetricaProduct[][] = [];
  let current: MetricaProduct[] = [];
  let size = JSON.stringify(actionField).length + 200; // envelope overhead
  for (const p of products) {
    const len = JSON.stringify(p).length + 10;
    if (size + len > 8000 && current.length) {
      chunks.push(current);
      current = [];
      size = 300;
    }
    current.push(p);
    size += len;
  }
  if (current.length || !chunks.length) chunks.push(current);

  chunks.forEach((part, i) => {
    const id = chunks.length > 1 ? `${order.id}-${i + 1}` : order.id;
    pushEcommerce({
      currencyCode: currency(),
      purchase: { actionField: { ...actionField, id }, products: part },
    });
  });
}

/**
 * Report an SPA page view ("hit") on client-side navigation. Without this
 * the counter would only see the first full page load, because routes
 * change without a document reload.
 */
export function trackHit(path?: string): void {
  if (!config?.enabled || !config.counter_id) return;
  const url = path
    ?? window.location.pathname + window.location.search;
  window.ym?.(Number(config.counter_id), "hit", url);
}

function currency(): string {
  return "RUB";
}

/**
 * Visitor ClientID from the `_ym_uid` cookie (set by the Metrica tag).
 * Sent with checkout into the module's own order custom field
 * `metrica_client_id` so orders can be matched to visits offline.
 */
export function clientId(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)_ym_uid=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/* ── Mapping from the storefront Product model ──────────────────── */

import type { Product } from "@/data/types";

/** Product → productFieldObject (id=SKU fallback id, single-level category). */
export function toMetricaProduct(
  p: Product,
  opts?: { qty?: number; list?: string; position?: number },
): MetricaProduct {
  return {
    id: String(p.sku || p.slug || p.id),
    name: p.title,
    price: p.price == null ? null : Number(p.price),
    brand: p.brand || undefined,
    category: p.categoryTitle || undefined,
    quantity: opts?.qty,
    list: opts?.list,
    position: opts?.position,
  };
}
