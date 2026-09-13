"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchProductConfigurator,
  validateProductBuild,
  type ConfiguratorSlot,
  type ConfiguratorSlotOption,
  type ProductConfigurator,
} from "@/lib/api";
import { configuratorTtlMs } from "@/lib/consent/consent";
import type { ConfiguratorBuild } from "@/data/types";

/** One picked SKU inside a slot (qty of that SKU). */
export type SlotPick = {
  productId: string;
  qty: number;
  option: ConfiguratorSlotOption;
};

/**
 * Slot selection:
 * - radio mode → at most one pick
 * - multi mode → several picks (capped by maxDifferentProducts / maxQty)
 */
export type SlotSelection = {
  picks: SlotPick[];
};

/** Radio when only one option, or when only one distinct SKU is allowed. */
export function isSlotMultiSelect(slot: ConfiguratorSlot): boolean {
  const maxDiff = Math.max(1, slot.maxDifferentProducts || 1);
  const optionCount = slot.options?.length ?? 0;
  return optionCount > 1 && maxDiff > 1;
}

function clampQty(slot: ConfiguratorSlot, qty: number): number {
  const minQ = Math.max(slot.minQty || 0, 1);
  const maxQ = Math.max(slot.maxQty || minQ, minQ);
  return Math.min(Math.max(qty, minQ), maxQ);
}

function slotKey(slot: ConfiguratorSlot): string {
  return slot.code || slot.attributeId || slot.id;
}

function findOption(
  slot: ConfiguratorSlot,
  productId: string,
  sku?: string,
): ConfiguratorSlotOption | undefined {
  return (
    slot.options.find((o) => o.productId === productId) ||
    (sku ? slot.options.find((o) => o.sku && o.sku === sku) : undefined)
  );
}

/**
 * Carry over picks that still exist on the new platform (same product id / sku
 * in a slot with the same attribute code). Missing → default for required slots.
 */
export function remapSelections(
  prevCfg: ProductConfigurator | null,
  prev: Record<string, SlotSelection>,
  next: ProductConfigurator,
): Record<string, SlotSelection> {
  const prevByKey = new Map<string, { slot: ConfiguratorSlot; sel: SlotSelection }>();
  if (prevCfg) {
    for (const s of prevCfg.slots) {
      prevByKey.set(slotKey(s), { slot: s, sel: prev[s.id] || { picks: [] } });
      prevByKey.set(s.id, { slot: s, sel: prev[s.id] || { picks: [] } });
      if (s.attributeId) {
        prevByKey.set(s.attributeId, { slot: s, sel: prev[s.id] || { picks: [] } });
      }
    }
  }

  const initial: Record<string, SlotSelection> = {};
  for (const slot of next.slots) {
    if (!slot.options.length) {
      initial[slot.id] = { picks: [] };
      continue;
    }
    const multi = isSlotMultiSelect(slot);
    const maxDiff = Math.max(1, slot.maxDifferentProducts || 1);
    const from =
      prevByKey.get(slotKey(slot)) ||
      prevByKey.get(slot.attributeId) ||
      prevByKey.get(slot.id);

    const picks: SlotPick[] = [];
    if (from?.sel.picks.length) {
      for (const old of from.sel.picks) {
        const opt = findOption(slot, old.productId, old.option.sku);
        if (!opt) continue;
        picks.push({
          productId: opt.productId,
          qty: clampQty(slot, old.qty || 1),
          option: opt,
        });
        if (!multi) break;
        if (picks.length >= maxDiff) break;
      }
    }

    if (!picks.length) {
      const def = slot.options.find((o) => o.isDefault);
      if (def) {
        picks.push({
          productId: def.productId,
          qty: clampQty(slot, Math.max(slot.minQty || 1, 1)),
          option: def,
        });
      }
    }

    // Cap total units
    const maxQ = Math.max(slot.maxQty || 1, 1);
    let units = picks.reduce((s, p) => s + p.qty, 0);
    if (units > maxQ) {
      const scaled = picks.map((p) => ({ ...p, qty: 1 }));
      while (scaled.reduce((s, p) => s + p.qty, 0) > maxQ && scaled.length > 1) {
        scaled.pop();
      }
      initial[slot.id] = { picks: scaled };
    } else {
      initial[slot.id] = { picks: picks.slice(0, maxDiff) };
    }
  }
  return initial;
}

/**
 * Сборка пользователя сохраняется в localStorage на 1 час (скользящий TTL):
 * обновление страницы и переходы по сайту не сбрасывают конфигуратор.
 * Привязана к товару-платформе; истёкшая сборка молча сбрасывается на дефолт.
 */
const PERSIST_KEY = "server-price-configurator-build-v1";
const FALLBACK_TTL_MS = 60 * 60 * 1000;

function persistTtlMs(): number {
  try {
    return configuratorTtlMs();
  } catch {
    return FALLBACK_TTL_MS;
  }
}

type PersistedBuild = {
  productKey: string;
  rows: Array<{ slot: string; product_id: string; qty: number }>;
  saved_at: number;
};

function loadPersistedBuild(): PersistedBuild | null {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedBuild | null;
    if (
      !parsed?.productKey ||
      !Array.isArray(parsed.rows) ||
      typeof parsed.saved_at !== "number"
    ) {
      return null;
    }
    if (parsed.saved_at + persistTtlMs() <= Date.now()) {
      // Срок хранения истёк — сборка «сгорела».
      localStorage.removeItem(PERSIST_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Поднимаем сохранённую сборку: слоты ищем по id / code / attributeId, неизвестные SKU отбрасываем. */
function restorePersistedSelections(
  data: ProductConfigurator,
  stored: PersistedBuild,
): Record<string, SlotSelection> | null {
  const byKey = new Map<string, Array<{ product_id: string; qty: number }>>();
  for (const row of stored.rows) {
    const list = byKey.get(row.slot) || [];
    list.push({ product_id: row.product_id, qty: row.qty });
    byKey.set(row.slot, list);
  }

  let used = false;
  const initial: Record<string, SlotSelection> = {};
  for (const slot of data.slots) {
    if (!slot.options.length) {
      initial[slot.id] = { picks: [] };
      continue;
    }
    const multi = isSlotMultiSelect(slot);
    const saved =
      byKey.get(slot.id) ||
      (slot.code ? byKey.get(slot.code) : undefined) ||
      (slot.attributeId ? byKey.get(slot.attributeId) : undefined) ||
      [];
    const picks: SlotPick[] = [];
    for (const row of saved) {
      const opt = slot.options.find((o) => o.productId === row.product_id);
      if (!opt) continue;
      used = true;
      picks.push({
        productId: opt.productId,
        qty: clampQty(slot, row.qty || 1),
        option: opt,
      });
      if (!multi) break;
    }
    if (!picks.length) {
      const def = slot.options.find((o) => o.isDefault);
      if (def) {
        picks.push({
          productId: def.productId,
          qty: clampQty(slot, Math.max(slot.minQty || 1, 1)),
          option: def,
        });
      }
    }
    const maxDiff = Math.max(1, slot.maxDifferentProducts || 1);
    initial[slot.id] = { picks: picks.slice(0, maxDiff) };
  }
  // Ни один слот не совпал — сохранение чужое/устаревшее, не применяем.
  return used ? initial : null;
}

function buildInitialSelections(
  data: ProductConfigurator,
  initialBuild?: ConfiguratorBuild | null,
): Record<string, SlotSelection> {  const initial: Record<string, SlotSelection> = {};
  const savedBySlot = new Map<string, Array<{ product_id: string; qty: number }>>();
  for (const s of initialBuild?.selections || []) {
    const list = savedBySlot.get(s.slot_id) || [];
    list.push({ product_id: s.product_id, qty: s.qty });
    savedBySlot.set(s.slot_id, list);
  }

  for (const slot of data.slots) {
    if (!slot.options.length) {
      initial[slot.id] = { picks: [] };
      continue;
    }
    const multi = isSlotMultiSelect(slot);
    const saved = savedBySlot.get(slot.id) || [];
    const picks: SlotPick[] = [];

    if (saved.length) {
      for (const row of saved) {
        const opt = slot.options.find((o) => o.productId === row.product_id);
        if (!opt) continue;
        picks.push({
          productId: opt.productId,
          qty: clampQty(slot, row.qty || 1),
          option: opt,
        });
        if (!multi) break;
      }
    }

    if (!picks.length) {
      const def = slot.options.find((o) => o.isDefault);
      if (def) {
        picks.push({
          productId: def.productId,
          qty: clampQty(slot, Math.max(slot.minQty || 1, 1)),
          option: def,
        });
      }
    }

    const maxDiff = Math.max(1, slot.maxDifferentProducts || 1);
    initial[slot.id] = { picks: picks.slice(0, maxDiff) };
  }
  return initial;
}

export function useProductConfigurator(
  productIdOrSlug: string | undefined,
  initialBuild?: ConfiguratorBuild | null,
) {
  const [cfg, setCfg] = useState<ProductConfigurator | null>(null);
  const [loading, setLoading] = useState(Boolean(productIdOrSlug));
  /** Soft platform switch — no full-page skeleton */
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<string, SlotSelection>>({});
  const cfgRef = useRef<ProductConfigurator | null>(null);
  const selectionsRef = useRef(selections);
  cfgRef.current = cfg;
  selectionsRef.current = selections;

  const buildKey = initialBuild
    ? JSON.stringify(initialBuild.selections)
    : "";
  /** Active platform slug/id (may diverge from route during soft switch). */
  const [activeKey, setActiveKey] = useState(productIdOrSlug || "");

  // Sync active key when parent product changes (external navigation)
  useEffect(() => {
    if (productIdOrSlug) setActiveKey(productIdOrSlug);
  }, [productIdOrSlug]);

  const load = useCallback(
    async (
      key: string,
      opts?: { soft?: boolean; preserve?: boolean; build?: ConfiguratorBuild | null },
    ) => {
      const soft = Boolean(opts?.soft && cfgRef.current);
      if (soft) setSwitching(true);
      else {
        setLoading(true);
        setError(null);
      }
      try {
        const data = await fetchProductConfigurator(key);
        if (!data) {
          if (!soft) {
            setCfg(null);
            setError("Конфигуратор недоступен для этого товара");
          }
          return null;
        }
        // Часовое сохранение: восстанавливаем сборку этого товара, если
        // нет явно открытой готовой конфигурации.
        const persisted =
          !opts?.build && !initialBuild?.selections?.length ? loadPersistedBuild() : null;
        const restored =
          persisted &&
          (persisted.productKey === data.slug ||
            persisted.productKey === data.productId ||
            persisted.productKey === key)
            ? restorePersistedSelections(data, persisted)
            : null;
        const nextSel = opts?.preserve
          ? remapSelections(cfgRef.current, selectionsRef.current, data)
          : restored ?? buildInitialSelections(data, opts?.build ?? initialBuild);
        setCfg(data);
        setSelections(nextSel);
        setActiveKey(data.slug || data.productId || key);
        setError(null);
        return data;
      } catch (e) {
        if (!soft) {
          setCfg(null);
          setError(e instanceof Error ? e.message : "Ошибка загрузки конфигуратора");
        }
        return null;
      } finally {
        setLoading(false);
        setSwitching(false);
      }
    },
    [initialBuild],
  );

  useEffect(() => {
    if (!productIdOrSlug) {
      setCfg(null);
      setLoading(false);
      return;
    }
    // Already on this platform after soft switch — do not hard-reload (keeps picks)
    const current = cfgRef.current;
    if (
      current &&
      (productIdOrSlug === current.slug || productIdOrSlug === current.productId)
    ) {
      return;
    }
    void load(productIdOrSlug, {
      soft: Boolean(current),
      preserve: Boolean(current) && !initialBuild?.selections?.length,
      build: initialBuild,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on product/build identity
  }, [productIdOrSlug, buildKey]);

  /**
   * Switch chassis without remounting the page.
   * Keeps options still available on the new platform (by product id / sku + slot code).
   */
  const switchPlatform = useCallback(
    async (slugOrId: string) => {
      if (!slugOrId) return null;
      if (
        slugOrId === activeKey ||
        slugOrId === cfgRef.current?.slug ||
        slugOrId === cfgRef.current?.productId
      ) {
        return cfgRef.current;
      }
      return load(slugOrId, { soft: true, preserve: true });
    },
    [activeKey, load],
  );

  const clearOption = useCallback((slot: ConfiguratorSlot) => {
    setSelections((prev) => ({ ...prev, [slot.id]: { picks: [] } }));
  }, []);

  /** Radio / single-product pick. */
  const setOption = useCallback((slot: ConfiguratorSlot, option: ConfiguratorSlotOption) => {
    setSelections((prev) => {
      const cur = prev[slot.id];
      const qty = cur?.picks[0]?.qty ?? clampQty(slot, Math.max(slot.minQty || 1, 1));
      return {
        ...prev,
        [slot.id]: {
          picks: [
            {
              productId: option.productId,
              qty: clampQty(slot, qty),
              option,
            },
          ],
        },
      };
    });
  }, []);

  /** Multi-select: toggle product in/out. */
  const toggleOption = useCallback((slot: ConfiguratorSlot, option: ConfiguratorSlotOption) => {
    setSelections((prev) => {
      const cur = prev[slot.id]?.picks || [];
      const exists = cur.find((p) => p.productId === option.productId);
      const maxDiff = Math.max(1, slot.maxDifferentProducts || 1);
      let next: SlotPick[];
      if (exists) {
        next = cur.filter((p) => p.productId !== option.productId);
      } else if (cur.length >= maxDiff) {
        next = [
          ...cur.slice(0, maxDiff - 1),
          {
            productId: option.productId,
            qty: clampQty(slot, 1),
            option,
          },
        ];
      } else {
        next = [
          ...cur,
          {
            productId: option.productId,
            qty: clampQty(slot, 1),
            option,
          },
        ];
      }
      const maxQ = Math.max(slot.maxQty || 1, 1);
      if (next.reduce((s, p) => s + p.qty, 0) > maxQ) {
        next = next.map((p) => ({ ...p, qty: 1 }));
        while (next.reduce((s, p) => s + p.qty, 0) > maxQ && next.length > 1) {
          next = next.slice(0, -1);
        }
      }
      return { ...prev, [slot.id]: { picks: next } };
    });
  }, []);

  const setQty = useCallback((slot: ConfiguratorSlot, productId: string, qty: number) => {
    setSelections((prev) => {
      const cur = prev[slot.id]?.picks || [];
      if (!cur.length) return prev;
      const maxQ = Math.max(slot.maxQty || 1, 1);
      const next = cur.map((p) =>
        p.productId === productId ? { ...p, qty: Math.max(1, qty) } : p,
      );
      const total = next.reduce((s, p) => s + p.qty, 0);
      if (total > maxQ) {
        const over = total - maxQ;
        const idx = next.findIndex((p) => p.productId === productId);
        if (idx >= 0) {
          next[idx] = {
            ...next[idx],
            qty: Math.max(1, next[idx].qty - over),
          };
        }
      }
      return { ...prev, [slot.id]: { picks: next } };
    });
  }, []);

  const setSlotQty = useCallback((slot: ConfiguratorSlot, qty: number) => {
    setSelections((prev) => {
      const cur = prev[slot.id]?.picks || [];
      if (cur.length !== 1) return prev;
      return {
        ...prev,
        [slot.id]: {
          picks: [{ ...cur[0], qty: clampQty(slot, qty) }],
        },
      };
    });
  }, []);

  const summary = useMemo(() => {
    if (!cfg) {
      return [] as Array<{
        slot: ConfiguratorSlot;
        picks: SlotPick[];
        lineTotal: number;
      }>;
    }
    return cfg.slots
      .map((slot) => {
        const picks = selections[slot.id]?.picks || [];
        if (!picks.length) return null;
        return {
          slot,
          picks,
          lineTotal: picks.reduce((s, p) => s + (p.option.price ?? 0) * p.qty, 0),
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [cfg, selections]);

  const componentsTotal = useMemo(
    () => summary.reduce((s, row) => s + row.lineTotal, 0),
    [summary],
  );

  const total = (cfg?.basePrice ?? 0) + componentsTotal;

  const buildSelections = useMemo(
    () =>
      summary.flatMap((row) =>
        row.picks.map((p) => ({
          slot_id: row.slot.id,
          product_id: p.productId,
          qty: p.qty,
        })),
      ),
    [summary],
  );

  const incomplete = useMemo(() => {
    if (!cfg) return true;
    return cfg.slots.some((slot) => {
      if (!slot.isRequired && slot.minQty < 1) return false;
      const picks = selections[slot.id]?.picks || [];
      if (!picks.length) return true;
      const units = picks.reduce((s, p) => s + p.qty, 0);
      return units < Math.max(slot.minQty, slot.isRequired ? 1 : 0);
    });
  }, [cfg, selections]);

  /**
   * Информационные предупреждения правил совместимости (сервер, /validate).
   * Не блокируют корзину — только подсвечивают несовместимую сборку.
   */
  const [ruleWarnings, setRuleWarnings] = useState<string[]>([]);
  const buildSelectionsKey = useMemo(() => JSON.stringify(buildSelections), [buildSelections]);

  // Скользящее сохранение сборки (TTL 1 час): любое изменение продлевает хранение.
  useEffect(() => {
    const key = cfg?.slug || cfg?.productId;
    if (!key || buildSelections.length === 0) return;
    const payload: PersistedBuild = {
      productKey: key,
      rows: buildSelections.map((s) => ({
        slot: s.slot_id,
        product_id: s.product_id,
        qty: s.qty,
      })),
      saved_at: Date.now(),
    };
    try {
      localStorage.setItem(PERSIST_KEY, JSON.stringify(payload));
    } catch {
      /* приватный режим — сборка просто не переживёт перезагрузку */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- buildSelectionsKey covers payload
  }, [buildSelectionsKey, cfg?.slug, cfg?.productId]);

  useEffect(() => {
    const key = cfg?.slug || cfg?.productId;
    if (!key || incomplete || buildSelections.length === 0) {
      setRuleWarnings([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      void validateProductBuild(key, buildSelections).then((res) => {
        if (!cancelled) setRuleWarnings(res.warnings || []);
      });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key covers payload
  }, [buildSelectionsKey, cfg?.slug, cfg?.productId, incomplete]);

  return {
    cfg,
    loading,
    switching,
    error,
    selections,
    setOption,
    clearOption,
    toggleOption,
    setQty,
    setSlotQty,
    summary,
    total,
    basePrice: cfg?.basePrice ?? 0,
    componentsTotal,
    buildSelections,
    incomplete,
    ruleWarnings,
    platforms: cfg?.platforms ?? [],
    activeKey,
    switchPlatform,
    isSlotMultiSelect,
  };
}

export type ProductConfiguratorState = ReturnType<typeof useProductConfigurator>;
