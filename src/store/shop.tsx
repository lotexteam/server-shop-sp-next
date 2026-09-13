"use client";

import * as React from "react";
import type { ConfiguratorBuild, Product, SavedConfig } from "@/data/types";
import { addToCart as metricaAddToCart, removeFromCart as metricaRemoveFromCart, toMetricaProduct } from "@/lib/analytics/metrica";

export const MAX_COMPARE = 4;

export type CartWarranty = {
  termId: string;
  packageId: string;
  name: string;
  price: number;
  months: number | null;
  isPaid: true;
  snapshot: Record<string, unknown>;
  serviceProductId: string | null;
};

export interface CartLine {
  product: Product;
  qty: number;
  priceKind?: "price" | "configurator";
  build?: ConfiguratorBuild;
  lineKey?: string;
  warranty?: CartWarranty;
}

/** «Под заказ» lines carry no price and are excluded from all totals. */
export function isLineOnRequest(line: CartLine): boolean {
  return line.product.onRequest === true || line.product.price == null;
}

export function cartLineGoodsTotal(line: CartLine): number {
  if (isLineOnRequest(line)) return 0;
  const extra = line.warranty?.isPaid ? line.warranty.price : 0;
  return line.qty * ((line.product.price ?? 0) + extra);
}

export type ToggleCompareResult =
  | { ok: true; action: "added" | "removed"; count: number }
  | { ok: false; reason: "limit"; max: number };

interface ShopState {
  cart: CartLine[];
  favorites: string[];
  compare: string[];
  savedConfigs: SavedConfig[];
  promoCode: string;
  setPromoCode: (code: string) => void;
  addToCart: (
    p: Product,
    qty?: number,
    extras?: {
      priceKind?: "price" | "configurator";
      build?: ConfiguratorBuild;
      warranty?: CartWarranty;
    },
  ) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  setQty: (id: string, qty: number) => void;
  toggleFav: (p: Product) => void;
  toggleCompare: (p: Product) => ToggleCompareResult;
  removeFromCompare: (id: string) => void;
  clearCompare: () => void;
  isInCompare: (id: string) => boolean;
  saveConfig: (cfg: Omit<SavedConfig, "id" | "createdAt"> & { name?: string }) => SavedConfig;
  removeSavedConfig: (id: string) => void;
  renameSavedConfig: (id: string, name: string) => void;
  cartCount: number;
  cartTotal: number;
}

const STORAGE_KEY = "server-price-shop-v2";
const LEGACY_KEY = "server-price-shop-v1";

function asIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === "string" && item.trim()) {
      out.push(item.trim());
      continue;
    }
    if (item && typeof item === "object") {
      const rec = item as { id?: unknown; slug?: unknown };
      const id = String(rec.id || rec.slug || "").trim();
      if (id) out.push(id);
    }
  }
  return [...new Set(out)];
}

function loadPersisted(): {
  cart: CartLine[];
  favorites: string[];
  compare: string[];
  savedConfigs: SavedConfig[];
  promoCode: string;
} {
  try {
    if (typeof localStorage === "undefined") {
      return { cart: [], favorites: [], compare: [], savedConfigs: [], promoCode: "" };
    }
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) return { cart: [], favorites: [], compare: [], savedConfigs: [], promoCode: "" };
    const data = JSON.parse(raw) as {
      cart?: unknown;
      favorites?: unknown;
      compare?: unknown;
      savedConfigs?: SavedConfig[];
      promoCode?: unknown;
    };
    return {
      cart: Array.isArray(data.cart)
        ? (data.cart as CartLine[]).filter(
            (l) => l && typeof l.qty === "number" && l.product && typeof l.product.id === "string",
          )
        : [],
      favorites: asIdList(data.favorites),
      compare: asIdList(data.compare).slice(0, MAX_COMPARE),
      savedConfigs: Array.isArray(data.savedConfigs) ? data.savedConfigs : [],
      promoCode: typeof data.promoCode === "string" ? data.promoCode.trim() : "",
    };
  } catch {
    return { cart: [], favorites: [], compare: [], savedConfigs: [], promoCode: "" };
  }
}

function writePersisted(next: {
  cart: CartLine[];
  favorites: string[];
  compare: string[];
  savedConfigs: SavedConfig[];
  promoCode: string;
}) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
}

const Ctx = React.createContext<ShopState | null>(null);

export const useShop = () => {
  const c = React.useContext(Ctx);
  if (!c) throw new Error("useShop must be used within <ShopProvider>");
  return c;
};

export function ShopProvider({ children }: { children: React.ReactNode }) {
  // SSR/гидрация (план миграции 7.3): первый рендер детерминированно пустой —
  // сервер не знает localStorage, а чтение в useState-инициализаторе давало
  // hydration mismatch (дерево клиента отличалось → сдвиг useId в шапке).
  // Сохранённые данные восстанавливаются effect'ом после монтирования.
  const [cart, setCart] = React.useState<CartLine[]>([]);
  const [favorites, setFavorites] = React.useState<string[]>([]);
  const [compare, setCompare] = React.useState<string[]>([]);
  const [savedConfigs, setSavedConfigs] = React.useState<SavedConfig[]>([]);
  const [promoCode, setPromoCodeState] = React.useState<string>("");

  React.useEffect(() => {
    const p = loadPersisted();
    setCart(p.cart);
    setFavorites(p.favorites);
    setCompare(p.compare);
    setSavedConfigs(p.savedConfigs);
    setPromoCodeState(p.promoCode);
  }, []);

  const persist = React.useCallback(
    (patch: Partial<{
      cart: CartLine[];
      favorites: string[];
      compare: string[];
      savedConfigs: SavedConfig[];
      promoCode: string;
    }>) => {
      writePersisted({
        cart: loadPersisted().cart,
        favorites: loadPersisted().favorites,
        compare: loadPersisted().compare,
        savedConfigs: loadPersisted().savedConfigs,
        promoCode: loadPersisted().promoCode,
        ...patch,
      });
    },
    [],
  );

  // Корзина переживает перезагрузку: сервер всё равно пересчитает итоги на checkout.
  const cartPersistMountedRef = React.useRef(false);
  React.useEffect(() => {
    // Первый прогон — mount с пустым cart ДО гидрации из localStorage:
    // пропускаем, чтобы не затереть сохранённую корзину. После гидрации
    // effect перезапустится уже с реальными данными.
    if (!cartPersistMountedRef.current) {
      cartPersistMountedRef.current = true;
      return;
    }
    persist({ cart });
  }, [cart, persist]);

  const setPromoCode = React.useCallback(
    (code: string) => {
      const next = code.trim();
      setPromoCodeState(next);
      persist({ promoCode: next });
    },
    [persist],
  );

  const addToCart = (
    p: Product,
    qty = 1,
    extras?: {
      priceKind?: "price" | "configurator";
      build?: ConfiguratorBuild;
      warranty?: CartWarranty;
    },
  ) => {
    // Ecommerce event before the state update (fire and forget).
    metricaAddToCart(toMetricaProduct(p, { qty }));
    return setCart((s) => {
      const priceKind = extras?.priceKind ?? "price";
      const build = extras?.build;
      const warranty = extras?.warranty;
      const wKey = warranty?.termId ? `:w:${warranty.termId}` : "";
      const lineKey =
        priceKind === "configurator" && build
          ? `${p.id}:cfg:${JSON.stringify(build.selections)}${wKey}`
          : `${p.id}${wKey}`;

      const found = s.find((l) => (l.lineKey ?? l.product.id) === lineKey);
      if (found) {
        return s.map((l) =>
          (l.lineKey ?? l.product.id) === lineKey ? { ...l, qty: l.qty + qty } : l,
        );
      }
      return [
        ...s,
        {
          product: p,
          qty,
          priceKind,
          build,
          lineKey,
          warranty,
        },
      ];
    });
  };

  const removeFromCart = (id: string) => {
    // Ecommerce event needs the line before it disappears.
    const line = cart.find(
      (l) => (l.lineKey ?? l.product.id) === id || l.product.id === id,
    );
    if (line) {
      metricaRemoveFromCart(toMetricaProduct(line.product, { qty: line.qty }));
    }
    return setCart((s) => s.filter((l) => (l.lineKey ?? l.product.id) !== id && l.product.id !== id));
  };
  const clearCart = () => {
    setCart([]);
    setPromoCodeState("");
    persist({ promoCode: "" });
  };

  const setQty = (id: string, qty: number) =>
    setCart((s) =>
      s.map((l) =>
        (l.lineKey ?? l.product.id) === id || l.product.id === id
          ? { ...l, qty: Math.max(1, qty) }
          : l,
      ),
    );

  const toggleFav = (p: Product) => {
    const keys = [p.id, p.slug].map((k) => String(k || "").trim()).filter(Boolean);
    setFavorites((s) => {
      const exists = keys.some((k) => s.includes(k));
      const next = exists ? s.filter((x) => !keys.includes(x)) : [...s, p.id];
      persist({ favorites: next });
      return next;
    });
  };

  const toggleCompare = (p: Product): ToggleCompareResult => {
    if (compare.includes(p.id) || (p.slug && compare.includes(p.slug))) {
      const next = compare.filter((x) => x !== p.id && x !== p.slug);
      setCompare(next);
      persist({ compare: next });
      return { ok: true, action: "removed", count: next.length };
    }
    if (compare.length >= MAX_COMPARE) {
      return { ok: false, reason: "limit", max: MAX_COMPARE };
    }
    const next = [...compare, p.id];
    setCompare(next);
    persist({ compare: next });
    return { ok: true, action: "added", count: next.length };
  };

  const removeFromCompare = (id: string) =>
    setCompare((s) => {
      const next = s.filter((x) => x !== id);
      persist({ compare: next });
      return next;
    });
  const clearCompare = () => {
    setCompare([]);
    persist({ compare: [] });
  };
  const isInCompare = (id: string) => compare.includes(id);

  const saveConfig = (
    cfg: Omit<SavedConfig, "id" | "createdAt"> & { name?: string },
  ): SavedConfig => {
    const entry: SavedConfig = {
      ...cfg,
      name: (cfg.name || cfg.productTitle || "Сборка").trim() || "Сборка",
      id:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `cfg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    };
    setSavedConfigs((s) => {
      const next = [entry, ...s];
      persist({ savedConfigs: next });
      return next;
    });
    return entry;
  };

  const removeSavedConfig = (id: string) =>
    setSavedConfigs((s) => {
      const next = s.filter((c) => c.id !== id);
      persist({ savedConfigs: next });
      return next;
    });

  const renameSavedConfig = (id: string, name: string) =>
    setSavedConfigs((s) => {
      const next = s.map((c) => (c.id === id ? { ...c, name: name.trim() || c.name } : c));
      persist({ savedConfigs: next });
      return next;
    });

  const cartCount = cart.reduce((n, l) => n + l.qty, 0);
  const cartTotal = cart.reduce((n, l) => n + cartLineGoodsTotal(l), 0);

  return (
    <Ctx.Provider
      value={{
        cart,
        favorites,
        compare,
        savedConfigs,
        promoCode,
        setPromoCode,
        addToCart,
        removeFromCart,
        clearCart,
        setQty,
        toggleFav,
        toggleCompare,
        removeFromCompare,
        clearCompare,
        isInCompare,
        saveConfig,
        removeSavedConfig,
        renameSavedConfig,
        cartCount,
        cartTotal,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
