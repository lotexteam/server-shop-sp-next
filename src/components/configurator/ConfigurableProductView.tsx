"use client";

/**
 * Вид карточки товара с is_configurable (слоты type=product).
 * Не отдельная «страница конфигуратора» — layout ProductPage + слоты + sticky состав.
 * Платформы = admin-linked merge (API platforms), UI как у атрибутов-слотов.
 */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Heart,
  Minus,
  Plus,
  Save,
  ShoppingCart,
  ShieldCheck,
  Truck,
  Wrench,
  Check,
  ChevronDown,
  Loader2,
  Share2,
  Printer,
} from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ZoomableProductImage } from "@/components/product/ZoomableProductImage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "@/components/ui/search";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

import { formatPrice, cn } from "@/lib/utils";
import { categoryHref } from "@/lib/api";
import { VatHint } from "@/components/common/Price";
import { ConfigPrintSheet } from "@/components/configurator/ConfigPrintSheet";
import { useShop } from "@/store/shop";
import { useAuth } from "@/store/auth";
import { useToast } from "@/components/ui/toast";
import { WarrantyPicker, toCartWarranty } from "@/components/product/WarrantyPicker";
import { useWarrantyOptions } from "@/hooks/useWarrantyOptions";
import {
  isSlotMultiSelect,
  useProductConfigurator,
  type SlotPick,
} from "@/hooks/useProductConfigurator";

import type { ConfiguratorBuild, Product } from "@/data/types";
import {
  apiCreateBuild,
  apiCreatePublicShareBuild,
  apiFetchSharedBuild,
  fetchProduct,
  storefrontShareUrl,
  StorefrontApiError,
  type ConfiguratorFilterDef,
  type ConfiguratorPlatform,
  type ConfiguratorSlot,
} from "@/lib/api";
import {
  stashSharedBuild,
  takeSharedBuildForProduct,
} from "@/views/SharedBuildPage";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Props = {
  product: Product;
};

export function ConfigurableProductView({ product }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToCart, toggleFav, favorites, saveConfig, savedConfigs, cart } = useShop();
  const { isAuthenticated } = useAuth();
  const savedConfigId = searchParams.get("config");
  const shareToken = searchParams.get("share");
  const editSlug = searchParams.get("edit");
  const [editBuild, setEditBuild] = useState<ConfiguratorBuild | null>(null);
  const [editReady, setEditReady] = useState(!editSlug);
  const [sharedBuild, setSharedBuild] = useState<ConfiguratorBuild | null>(() => {
    const stashed = takeSharedBuildForProduct(product.id) ||
      takeSharedBuildForProduct(product.slug);
    return stashed ? { selections: stashed.selections } : null;
  });

  useEffect(() => {
    if (!editSlug) {
      setEditBuild(null);
      setEditReady(true);
      return;
    }
    setEditReady(false);
    let cancelled = false;
    void fetchProduct(editSlug).then((p) => {
      if (cancelled) return;
      const sels = p?.configuratorEdit?.selections || [];
      setEditBuild(sels.length ? { selections: sels } : null);
      setEditReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [editSlug]);

  useEffect(() => {
    if (!shareToken) return;
    const stashed = takeSharedBuildForProduct(product.id) ||
      takeSharedBuildForProduct(product.slug);
    if (stashed?.selections?.length) {
      setSharedBuild({ selections: stashed.selections });
      return;
    }
    let cancelled = false;
    void apiFetchSharedBuild(shareToken)
      .then((b) => {
        if (cancelled) return;
        stashSharedBuild(b);
        setSharedBuild({ selections: b.selections || [] });
      })
      .catch(() => {
        /* ignore — show default config */
      });
    return () => {
      cancelled = true;
    };
  }, [shareToken, product.id, product.slug]);

  const initialBuild = useMemo((): ConfiguratorBuild | null => {
    if (editBuild?.selections?.length) return editBuild;
    if (sharedBuild?.selections?.length) return sharedBuild;
    if (!savedConfigId) return null;
    const fromCart = cart.find((l) => l.lineKey === savedConfigId && l.build?.selections?.length);
    if (fromCart?.build && (fromCart.product.id === product.id || fromCart.product.slug === product.slug)) {
      return fromCart.build;
    }
    const found = savedConfigs.find((c) => c.id === savedConfigId);
    if (!found) return null;
    if (found.productId !== product.id && found.productSlug !== product.slug) {
      return null;
    }
    return found.build;
  }, [editBuild, sharedBuild, savedConfigId, savedConfigs, cart, product.id, product.slug]);

  const state = useProductConfigurator(product.slug, initialBuild);
  const [warrantyTermId, setWarrantyTermId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const { push } = useToast();

  /** Platforms from admin API only (not «all servers in category»). */
  const apiPlatforms = state.cfg?.platforms ?? [];
  const platformLabel = (name: string) =>
    name.replace(/^Сервер\s+/i, "").trim() || name;

  // Active chassis: from cfg after soft-switch, else initial product
  const activePlatform = useMemo(() => {
    const id = state.cfg?.productId;
    const slug = state.cfg?.slug;
    return (
      apiPlatforms.find((p) => p.id === id || p.slug === slug) ||
      apiPlatforms.find((p) => p.id === product.id || p.slug === product.slug) ||
      null
    );
  }, [apiPlatforms, state.cfg?.productId, state.cfg?.slug, product.id, product.slug]);

  const displayTitle =
    activePlatform?.name || state.cfg?.name || product.title;
  const displayLabel = platformLabel(displayTitle);
  const displaySku =
    activePlatform?.sku || product.sku || state.cfg?.slug || product.slug;
  const isFav =
    favorites.includes(product.id) ||
    (product.slug ? favorites.includes(product.slug) : false);
  const gallery =
    product.images && product.images.length > 0
      ? product.images
      : [product.image];

  const onPlatformSelect = async (p: ConfiguratorPlatform) => {
    if (
      p.id === state.cfg?.productId ||
      p.slug === state.cfg?.slug ||
      p.id === product.id && !state.cfg
    ) {
      return;
    }
    const data = await state.switchPlatform(p.slug || p.id);
    if (!data) {
      push({
        variant: "error",
        title: "Не удалось сменить платформу",
        description: "Попробуйте ещё раз",
      });
      return;
    }
    // Sync URL without remounting the whole product page tree if possible
    router.replace(`/product/${data.slug || p.slug}`);
  };

  const pickLabel = (picks: SlotPick[]) =>
    picks
      .map((p) => `${p.option.name} x ${p.qty}`)
      .join(", ");

  const cartProductId = state.cfg?.productId || product.id;
  const cartSlug = state.cfg?.slug || product.slug;

  const buildCartProduct = (): Product => ({
    ...product,
    id: cartProductId,
    slug: cartSlug,
    title: displayTitle,
    sku: displaySku,
    price: state.total,
    badges: ["Конфигуратор"],
    specs: state.summary.map((row) => ({
      label: row.slot.name,
      value: pickLabel(row.picks),
    })),
    composition: state.summary.flatMap((row) =>
      row.picks.map((pick) => ({
        slot: row.slot.name,
        name: pick.option.name,
        qty: Math.max(1, pick.qty),
      })),
    ),
  });

  const warrantyBuild =
    !state.incomplete && state.buildSelections.length
      ? { selections: state.buildSelections }
      : null;
  const { options: warrantyOptions, loading: warrantyLoading } =
    useWarrantyOptions(state.cfg?.productId || product.id, warrantyBuild);
  const warrantyChoice =
    warrantyOptions.find((o) => o.termId === warrantyTermId) ||
    warrantyOptions.find((o) => !o.isPaid) ||
    null;
  const warrantyExtra = warrantyChoice?.isPaid ? warrantyChoice.price : 0;

  const printRows = useMemo(() => {
    const rows: Array<{
      slot: string;
      name: string;
      unitPrice: number | null;
      qty: number | null;
      sum: number | null;
    }> = [
      {
        slot: "Платформа",
        name: displayTitle,
        unitPrice: state.basePrice,
        qty: 1,
        sum: state.basePrice,
      },
    ];
    if (state.cfg) {
      for (const slot of state.cfg.slots) {
        const picks = state.selections[slot.id]?.picks || [];
        if (!picks.length) {
          rows.push({ slot: slot.name, name: "—", unitPrice: null, qty: null, sum: null });
          continue;
        }
        for (const p of picks) {
          rows.push({
            slot: slot.name,
            name: p.option.name,
            unitPrice: p.option.price,
            qty: p.qty,
            sum: (p.option.price ?? 0) * p.qty,
          });
        }
      }
    }
    return rows;
  }, [displayTitle, state.basePrice, state.cfg, state.selections]);

  const printConfig = () => {
    document.body.classList.add("printing-config");
    const done = () => {
      document.body.classList.remove("printing-config");
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    window.setTimeout(() => window.print(), 50);
  };

  useEffect(() => {
    if (!warrantyOptions.length) return;
    if (warrantyTermId && warrantyOptions.some((o) => o.termId === warrantyTermId)) {
      return;
    }
    const base = warrantyOptions.find((o) => !o.isPaid);
    setWarrantyTermId(base?.termId ?? warrantyOptions[0]?.termId ?? null);
  }, [warrantyOptions, warrantyTermId]);

  const buy = () => {
    if (state.incomplete || !state.cfg) {
      push({ variant: "error", title: "Выберите обязательные компоненты" });
      return;
    }
    const w = toCartWarranty(warrantyChoice);
    addToCart(buildCartProduct(), qty, {
      priceKind: "configurator",
      build: { selections: state.buildSelections },
      warranty: w,
    });
    const extra = w ? w.price * qty : 0;
    push({
      variant: "success",
      title: "Конфигурация в корзине",
      description: `${displayTitle} x ${qty} · ${formatPrice(state.total * qty + extra)}`,
    });
  };

  const selectionPayload = () =>
    state.buildSelections.filter(
      (s) => UUID_RE.test(s.slot_id) && UUID_RE.test(s.product_id) && s.qty >= 1,
    );

  const save = async () => {
    if (state.incomplete || !state.cfg) {
      push({ variant: "error", title: "Выберите обязательные компоненты" });
      return;
    }
    if (!isAuthenticated) {
      push({
        variant: "warning",
        title: "Войдите, чтобы сохранить сборку",
        description: "Сохранённые сборки привязаны к аккаунту. Ссылку можно скопировать без входа.",
      });
      router.push("/account");
      return;
    }

    const parentId = cartProductId;
    if (!UUID_RE.test(parentId)) {
      push({
        variant: "error",
        title: "Не удалось сохранить",
        description: "Нет UUID товара платформы — обновите страницу",
      });
      return;
    }

    setSaving(true);
    try {
      const created = await apiCreateBuild({
        name: displayTitle,
        parent_product_id: parentId,
        selections: selectionPayload(),
      });

      // Keep a local mirror for deep-links / offline UX
      saveConfig({
        name: created.name || displayTitle,
        productId: cartProductId,
        productSlug: cartSlug,
        productTitle: displayTitle,
        productImage: product.image,
        brand: product.brand,
        total: Number(created.total_display ?? created.total_amount) || state.total,
        build: { selections: state.buildSelections },
        lines: [
          { label: "Платформа", value: displayTitle, price: state.basePrice },
          ...state.summary.map((row) => ({
            label: row.slot.name,
            value: pickLabel(row.picks),
            price: row.lineTotal,
          })),
        ],
      });

      push({
        variant: "success",
        title: "Сборка сохранена",
        description: created.number
          ? `«${created.name}» · ${created.number} — ЛК → Сохранённые сборки`
          : `«${created.name}» — в личном кабинете → Сохранённые сборки`,
      });
    } catch (e) {
      const msg =
        e instanceof StorefrontApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Ошибка API";
      push({
        variant: "error",
        title: "Не удалось сохранить сборку",
        description: msg,
      });
    } finally {
      setSaving(false);
    }
  };

  /** Public share link — works without account. */
  const share = async () => {
    if (state.incomplete || !state.cfg) {
      push({ variant: "error", title: "Выберите обязательные компоненты" });
      return;
    }
    const parentId = cartProductId;
    if (!UUID_RE.test(parentId)) {
      push({
        variant: "error",
        title: "Не удалось создать ссылку",
        description: "Нет UUID платформы — обновите страницу",
      });
      return;
    }
    setSharing(true);
    try {
      const created = await apiCreatePublicShareBuild({
        name: displayTitle,
        parent_product_id: parentId,
        selections: selectionPayload(),
      });
      const token = created.share_token;
      const path = created.share_path || (token ? `/build/${token}` : null);
      if (!path && !token) {
        throw new Error("Сервер не вернул share_token");
      }
      const url = storefrontShareUrl(path || token!);
      try {
        await navigator.clipboard.writeText(url);
        push({
          variant: "success",
          title: "Ссылка скопирована",
          description: "Любой может открыть сборку без входа",
        });
      } catch {
        push({
          variant: "success",
          title: "Ссылка для шаринга",
          description: url,
        });
      }
    } catch (e) {
      push({
        variant: "error",
        title: "Не удалось создать ссылку",
        description:
          e instanceof Error ? e.message : "Ошибка API",
      });
    } finally {
      setSharing(false);
    }
  };

  // Wait for ?edit= snapshot and first configurator load — never flash the empty-slots error.
  const waitingCfg =
    Boolean(editSlug && !editReady) ||
    (state.loading && !state.cfg) ||
    (!state.cfg && !state.error && !state.switching);

  if (waitingCfg) {
    return (
      <div className="container-page py-6 lg:py-8 space-y-6">
        <Skeleton className="h-6 w-48" />
        <div className="grid gap-8 lg:grid-cols-2">
          <Skeleton className="aspect-square max-w-[70%] rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  if ((state.error || !state.cfg) && !state.switching) {
    return (
      <div className="container-page py-10">
        <Alert variant="error" title="Сборка недоступна">
          {state.error || "Не удалось загрузить конфигуратор для этого товара."}
        </Alert>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/catalog">В каталог</Link>
        </Button>
      </div>
    );
  }

  if (!state.cfg) return null;

  return (
    <div
      className={cn(
        "container-page py-6 pb-28 lg:pb-8 lg:py-8",
        state.switching && "pointer-events-none opacity-90",
      )}
    >
      <Breadcrumbs
        items={[
          { label: "Каталог", href: "/catalog" },
          { label: "Серверы", href: categoryHref("servers") },
          { label: displayTitle },
        ]}
        className="mb-5"
      />

      {/* Шапка: фото + цена от / база — отдельная карточка над слотами */}
      <div className="mb-8 w-full rounded-lg border border-border bg-card p-4 shadow-card sm:p-5">
        <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        <div className="flex shrink-0 flex-row items-start gap-2.5">
          <ZoomableProductImage
            images={gallery}
            index={activeImg}
            onIndex={setActiveImg}
            alt={displayTitle}
            title={displayTitle}
            className="size-[14rem] shrink-0 rounded-lg border border-border bg-secondary sm:size-[16rem]"
            imgClassName="max-h-full max-w-full object-contain"
          />
          <div className="flex shrink-0 flex-col gap-2">
            {gallery.map((g, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveImg(i)}
                className={cn(
                  "flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border-2 bg-secondary transition-colors sm:size-16",
                  activeImg === i ? "border-primary" : "border-border hover:border-primary/40",
                )}
              >
                <img src={g} alt="" className="max-h-full max-w-full object-contain" />
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 sm:min-h-[11.2rem] sm:justify-between sm:py-0.5">
          <div className="space-y-1.5">
            {state.switching ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-caption text-muted-foreground">
                  смена платформы…
                </span>
              </div>
            ) : null}
            <h1 className="text-h3 leading-snug sm:text-h2 sm:leading-tight">
              {displayTitle}
            </h1>
            <p className="text-body-sm text-muted-foreground">
              {[
                displaySku ? `Артикул: ${displaySku}` : "",
                product.brand?.trim() ? `Бренд: ${product.brand}` : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {(activePlatform?.shortDescription || product.shortDescription) && (
              <p className="line-clamp-2 text-body-sm text-muted-foreground">
                {activePlatform?.shortDescription || product.shortDescription}
              </p>
            )}

            {/* Цена: от (текущая сборка) + база платформы */}
            <div className="flex flex-wrap items-end gap-x-4 gap-y-1 pt-1">
              {activePlatform?.onRequest ? (
                <div>
                  <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
                    Цена
                  </p>
                  <p className="text-h3 font-bold text-foreground sm:text-h2">Под заказ</p>
                </div>
              ) : (
                <div>
                  <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
                    Цена от
                  </p>
                  <p className="text-h3 font-bold tabular-nums text-foreground sm:text-h2">
                    {formatPrice(state.total + warrantyExtra)}
                  </p>
                  <VatHint />
                </div>
              )}
              {!activePlatform?.onRequest && (
                <div className="pb-0.5">
                  <p className="text-caption text-muted-foreground">База платформы</p>
                  <p className="text-body font-semibold tabular-nums text-muted-foreground">
                    {formatPrice(state.basePrice)}
                  </p>
                </div>
              )}
              {!activePlatform?.onRequest && state.componentsTotal > 0 && (
                <div className="pb-0.5">
                  <p className="text-caption text-muted-foreground">Комплектующие</p>
                  <p className="text-body font-semibold tabular-nums text-muted-foreground">
                    +{formatPrice(state.componentsTotal)}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-0.5">
              <Badge variant="outline">Тестирование под нагрузкой</Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                ...(product.warranty
                  ? [
                      {
                        Icon: ShieldCheck,
                        label: `Гарантия: ${product.warranty.label}`,
                      },
                    ]
                  : []),
                { Icon: Truck, label: "Доставка 1–3 дня" },
                { Icon: Wrench, label: "Протестировано" },
              ] as Array<{ Icon: typeof ShieldCheck; label: string }>
            ).map(({ Icon, label }) => (
              <div
                key={label}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5"
              >
                <Icon className="size-4 shrink-0 text-primary" />
                <span className="text-caption font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
        </div>
      </div>

      {/* Платформа (как атрибут) + слоты | sticky состав */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="min-w-0">
          <Tabs defaultValue="configurator">
            <TabsList className="relative z-10 mb-3 flex h-auto w-full max-w-full justify-start">
              <TabsTrigger value="configurator">Конфигуратор</TabsTrigger>
              <TabsTrigger value="specs">Характеристики</TabsTrigger>
            </TabsList>

            {/* Слоты: платформа + компоненты (товары) */}
            <TabsContent value="configurator" className="mt-0 space-y-3">
          {apiPlatforms.length > 1 && (
            <PlatformPanel
              platforms={apiPlatforms}
              currentProductId={state.cfg.productId || product.id}
              currentLabel={displayLabel}
              currentPrice={state.basePrice}
              defaultOpen
              onSelect={(p) => void onPlatformSelect(p)}
            />
          )}
          {state.cfg.slots.map((slot) => (
            <SlotPanel
              key={slot.attributeId || slot.code || slot.id}
              slot={slot}
              filterDefs={state.cfg?.filters || []}
              picks={state.selections[slot.id]?.picks || []}
              multi={isSlotMultiSelect(slot)}
              onSelect={(opt) => state.setOption(slot, opt)}
              onClear={() => state.clearOption(slot)}
              onToggle={(opt) => state.toggleOption(slot, opt)}
              onQty={(productId, q) => state.setQty(slot, productId, q)}
              onSlotQty={(q) => state.setSlotQty(slot, q)}
              defaultOpen={false}
            />
          ))}
          <WarrantyPicker
            options={warrantyOptions}
            loading={warrantyLoading}
            selectedTermId={warrantyTermId}
            onSelect={(opt) => setWarrantyTermId(opt?.termId ?? null)}
          />
            </TabsContent>

            {/* Характеристики: текстовые атрибуты товара */}
            <TabsContent value="specs" className="mt-0">
              <div className="surface-card overflow-hidden">
                <Table>
                  <TableBody>
                    {product.specs.length > 0 ? (
                      product.specs.map((s, i) => (
                        <TableRow key={`spec-${i}`}>
                          <TableCell className="w-1/2 text-muted-foreground">
                            {s.label}
                          </TableCell>
                          <TableCell className="font-medium">{s.value}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={2} className="text-muted-foreground">
                          Характеристики не заданы
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="sticky-below-header hidden lg:block">
          <div className="surface-card flex max-h-[calc(100vh-var(--header-offset)-1.5rem)] flex-col overflow-hidden">
            <div className="shrink-0 border-b border-border px-5 pb-2 pt-3">
              <h2 className="text-h6">Состав конфигурации</h2>
              <p className="mt-0.5 truncate text-caption text-muted-foreground">
                {displayTitle}
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-1.5 scrollbar-thin">
              <ul>
                <li
                  className="flex items-baseline justify-between gap-2 border-b border-border/60 py-1"
                  title={displayTitle}
                >
                  <span className="min-w-0 text-caption">
                    <span className="text-muted-foreground">Платформа · </span>
                    <span className="font-medium">{displayTitle}</span>
                  </span>
                  <span className="shrink-0 text-caption font-semibold tabular-nums">
                    {formatPrice(state.basePrice)}
                  </span>
                </li>
                {state.summary.map((row) => (
                  <li
                    key={row.slot.id}
                    className="border-b border-border/60 py-1 last:border-0"
                  >
                    {row.picks.map((p, i) => {
                      const pickText = `${p.option.name} x ${p.qty}`;
                      return (
                        <div
                          key={p.option.id ?? i}
                          className="flex items-baseline justify-between gap-2"
                          title={pickText}
                        >
                          <span className="min-w-0 text-caption">
                            {i === 0 && (
                              <span className="text-muted-foreground">{row.slot.name} · </span>
                            )}
                            <span className="font-medium">{pickText}</span>
                          </span>
                          {i === 0 && (
                            <span className="shrink-0 text-caption font-semibold tabular-nums">
                              {row.picks.some((p) => p.option.onRequest)
                                ? "под заказ"
                                : row.lineTotal === 0
                                  ? "вкл."
                                  : formatPrice(row.lineTotal)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </li>
                ))}
                {warrantyChoice && (
                  <li
                    className="flex items-baseline justify-between gap-2 border-b border-border/60 py-1 last:border-0"
                    title={warrantyChoice.name}
                  >
                    <span className="min-w-0 text-caption">
                      <span className="text-muted-foreground">Гарантия · </span>
                      <span className="font-medium">{warrantyChoice.name}</span>
                    </span>
                    <span className="shrink-0 text-caption font-semibold tabular-nums">
                      {warrantyExtra === 0 ? "вкл." : formatPrice(warrantyExtra)}
                    </span>
                  </li>
                )}
              </ul>
            </div>

            <div className="shrink-0 space-y-2 border-t border-border bg-card px-5 py-3 shadow-[0_-6px_16px_-8px_rgba(0,0,0,0.12)]">
              {state.ruleWarnings.map((w, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-caption text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-200"
                >
                  <Wrench className="mt-0.5 size-3.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-semibold">Замечание совместимости</div>
                    <div className="min-w-0 break-words">{w}</div>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3" title="Сборка и тест · 3–5 дн.">
                <span className="text-body-sm text-muted-foreground">Итого</span>
                <span className="text-right">
                  <span className="block text-h3 font-bold tabular-nums">
                    {formatPrice(state.total + warrantyExtra)}
                  </span>
                  <VatHint />
                </span>
              </div>
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex w-fit shrink-0 items-center gap-1 rounded-md border border-input p-1">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                  >
                    <Minus className="size-4" />
                  </Button>
                  <span className="w-10 text-center font-semibold">{qty}</span>
                  <Button size="icon-sm" variant="ghost" onClick={() => setQty((q) => q + 1)}>
                    <Plus className="size-4" />
                  </Button>
                </div>
                <Button
                  size="lg"
                  variant="gradient"
                  className="h-auto min-h-12 w-full min-w-0 flex-1 whitespace-normal px-4"
                  onClick={buy}
                  disabled={state.incomplete}
                >
                  <ShoppingCart className="size-4 shrink-0 text-white" />
                  <span className="min-w-0 break-words text-white tabular-nums">
                    {formatPrice((state.total + warrantyExtra) * qty)}
                  </span>
                </Button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="icon-sm"
                  title={isFav ? "В избранном" : "В избранное"}
                  onClick={() => {
                    toggleFav(product);
                    push({ variant: "info", title: "Избранное обновлено" });
                  }}
                >
                  <Heart className={cn("size-4", isFav && "fill-accent text-accent")} />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  title="Сохранить конфигурацию"
                  onClick={() => void save()}
                  disabled={state.incomplete || saving || sharing}
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  title="Печать"
                  onClick={printConfig}
                  disabled={state.incomplete}
                >
                  <Printer className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  title="Поделиться ссылкой (открывается без аккаунта)"
                  onClick={() => void share()}
                  disabled={state.incomplete || sharing || saving}
                >
                  {sharing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Share2 className="size-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile sticky order */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 p-3 backdrop-blur lg:hidden">
        <div className="container-page flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-caption text-muted-foreground">{displayTitle}</p>
            <p className="text-h5 font-bold tabular-nums">
              {formatPrice((state.total + warrantyExtra) * qty)}
            </p>
            <VatHint />
          </div>
          <Button
            size="icon"
            variant="outline"
            onClick={printConfig}
            disabled={state.incomplete}
            aria-label="Печать"
          >
            <Printer className="size-4" />
          </Button>
          <Button size="lg" variant="gradient" onClick={buy} disabled={state.incomplete}>
            В корзину
          </Button>
        </div>
      </div>

      {createPortal(
        <ConfigPrintSheet
          platformName={displayTitle}
          rows={printRows}
          qty={qty}
          unitTotal={state.total + warrantyExtra}
          warrantyName={warrantyChoice?.name}
          warrantySum={warrantyExtra}
        />,
        document.body,
      )}
    </div>
  );
}

/** First attribute-like block: chassis / platform from admin-linked list. */
function PlatformPanel({
  platforms,
  currentProductId,
  currentLabel,
  currentPrice,
  onSelect,
  defaultOpen = true,
}: {
  platforms: ConfiguratorPlatform[];
  currentProductId: string;
  currentLabel: string;
  currentPrice: number;
  onSelect: (p: ConfiguratorPlatform) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");
  const selected =
    platforms.find((p) => p.id === currentProductId) ||
    platforms.find((p) => p.isDefault) ||
    platforms[0];
  const label = selected?.label || currentLabel;
  const price = selected?.id === currentProductId ? currentPrice : selected?.price ?? currentPrice;

  return (
    <section className="surface-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-secondary/40"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-h6">Платформа</h3>
            <span className="text-caption text-muted-foreground">обяз.</span>
          </div>
          <p className="mt-1 text-body-sm font-medium leading-snug text-foreground">
            {label}
          </p>
          {selected?.shortDescription && (
            <p className="mt-0.5 line-clamp-1 text-caption text-muted-foreground">
              {selected.shortDescription}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-body-sm font-semibold tabular-nums text-foreground">
            {selected?.onRequest
              ? "Под заказ"
              : price === 0
                ? "вкл."
                : formatPrice(price)}
          </span>
          <ChevronDown
            className={cn(
              "size-5 text-muted-foreground transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </div>
      </button>

      {open && (
        <div className="border-t border-border">
          <div className="border-b border-border/70 px-5 py-3">
            <Search
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClear={() => setQuery("")}
              placeholder="Поиск платформы…"
              className="h-9"
            />
          </div>
          <ul className="divide-y divide-border">
            {(query.trim()
              ? platforms.filter((p) => {
                  const q = query.trim().toLowerCase();
                  return (
                    p.label.toLowerCase().includes(q) ||
                    (p.name || "").toLowerCase().includes(q) ||
                    (p.shortDescription || "").toLowerCase().includes(q)
                  );
                })
              : platforms
            ).map((p) => {
              const active = p.id === currentProductId;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(p)}
                    className={cn(
                      "flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors",
                      active ? "bg-primary/5" : "hover:bg-secondary/60",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                        active ? "border-primary bg-primary text-white" : "border-border",
                      )}
                    >
                      {active && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-body-sm font-semibold">{p.label}</span>
                      {p.shortDescription && (
                        <span className="mt-0.5 block text-caption text-muted-foreground">
                          {p.shortDescription}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-body-sm font-semibold tabular-nums">
                      {p.onRequest
                        ? "Под заказ"
                         : p.price == null
                          ? "вкл."
                          : formatPrice(p.price)}
                    </span>
                  </button>
                </li>
              );
            })}
            {platforms.length === 0 && (
              <li className="px-5 py-4 text-body-sm text-muted-foreground">
                Нет связанных платформ (настройте в админке → Конфигуратор → платформы)
              </li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}

function SlotPanel({
  slot,
  filterDefs,
  picks,
  multi,
  onSelect,
  onClear,
  onToggle,
  onQty,
  onSlotQty,
  defaultOpen = false,
}: {
  slot: ConfiguratorSlot;
  filterDefs: ConfiguratorFilterDef[];
  picks: SlotPick[];
  multi: boolean;
  onSelect: (opt: ConfiguratorSlot["options"][0]) => void;
  onClear?: () => void;
  onToggle: (opt: ConfiguratorSlot["options"][0]) => void;
  onQty: (productId: string, qty: number) => void;
  onSlotQty: (qty: number) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");
  const [facet, setFacet] = useState<Record<string, string[]>>({});
  const [facetRanges, setFacetRanges] = useState<Record<string, { min?: number; max?: number }>>({});
  const required = slot.isRequired || slot.minQty >= 1;
  const selectedIds = new Set(picks.map((p) => p.productId));
  const units = picks.reduce((s, p) => s + p.qty, 0);
  const lineTotal = picks.reduce((s, p) => s + (p.option.price ?? 0) * p.qty, 0);
  const lineOnRequest = picks.some((p) => p.option.onRequest);
  const singlePick = !multi && picks[0];
  const multiQtySingle = !multi && slot.maxQty > 1 && singlePick;

  const summaryLine = picks.length
    ? picks
        .map((p) => `${p.option.name} x ${p.qty}`)
        .join(", ")
    : required
      ? "Не выбрано"
      : "Не выбрано (необязательно)";

  const priceLabel = !picks.length
    ? "—"
    : lineOnRequest
      ? "под заказ"
      : lineTotal === 0
        ? "вкл."
        : formatPrice(lineTotal);

  const modeHint = multi
    ? slot.maxQty > 1
      ? `несколько · до ${slot.maxQty} шт.`
      : "несколько позиций"
    : slot.options.length <= 1
      ? "1 вариант"
      : "один вариант";

  const chipGroups = (filterDefs || []).filter((def) => def.filter_mode !== "numeric")
    .map((def) => {
      const uniq = new Map<string, string>();
      for (const opt of slot.options) {
        for (const tok of opt.filterValues?.[def.code] || []) {
          if (tok.value) uniq.set(tok.value, tok.label || tok.value);
        }
      }
      if (uniq.size < 2) return null;
      return {
        code: def.code,
        name: def.name,
        values: [...uniq.entries()].map(([value, label]) => ({ value, label })),
      };
    })
    .filter((g): g is { code: string; name: string; values: Array<{ value: string; label: string }> } => Boolean(g));
  const numericGroups = (filterDefs || []).filter((def) => def.filter_mode === "numeric").map((def) => {
    const values = slot.options.flatMap((opt) => (opt.filterValues?.[def.code] || []).map((t) => t.value))
      .map(Number).filter(Number.isFinite).sort((a, b) => a - b).filter((v, i, a) => i === 0 || v !== a[i - 1]);
    return values.length > 1 ? { def, values } : null;
  }).filter(Boolean) as Array<{ def: ConfiguratorFilterDef; values: number[] }>;

  const q = query.trim().toLowerCase();
  const visibleOptions = slot.options.filter((opt) => {
    if (selectedIds.has(opt.productId)) return true;
    if (q) {
      const hay = `${opt.name} ${opt.sku || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    for (const [code, values] of Object.entries(facet)) {
      if (!values.length) continue;
      const tokens = opt.filterValues?.[code] || [];
      if (!tokens.some((t) => values.includes(t.value))) return false;
    }
    for (const [code, range] of Object.entries(facetRanges)) {
      const values = (opt.filterValues?.[code] || []).map((t) => Number(t.value)).filter(Number.isFinite);
      if (!values.length || (range.min != null && Math.max(...values) < range.min) || (range.max != null && Math.min(...values) > range.max)) return false;
    }
    return true;
  });

  return (
    <section className="surface-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-secondary/40"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-h6">{slot.name || "Слот"}</h3>
            <span className="text-caption text-muted-foreground">
              {required ? "обяз." : "опц."}
              {` · ${modeHint}`}
            </span>
          </div>
          <p
            className={cn(
              "mt-1 text-body-sm font-medium leading-snug",
              picks.length ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {summaryLine}
          </p>
          {picks.length > 0 && (
            <p className="mt-0.5 text-caption text-muted-foreground">
              {units} шт.
              {lineTotal > 0 ? ` · ${formatPrice(lineTotal)}` : " · включено"}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={cn(
              "text-body-sm font-semibold tabular-nums",
              picks.length ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {priceLabel}
          </span>
          <ChevronDown
            className={cn(
              "size-5 text-muted-foreground transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </div>
      </button>

      {open && (
        <div className="border-t border-border">
          <div className="border-b border-border/70 px-5 py-3">
            <Search
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClear={() => setQuery("")}
              placeholder={`Поиск: ${slot.name || "наименование"}…`}
              className="h-9"
            />
            {(chipGroups.length > 0 || numericGroups.length > 0) && (
              <div className="mt-3 space-y-2">
                {numericGroups.map(({ def, values }) => {
                  const range = facetRanges[def.code] || {};
                  const low = range.min ?? values[0];
                  const high = range.max ?? values[values.length - 1];
                  const lowIndex = Math.max(0, values.findIndex((v) => v >= low));
                  const highIndex = Math.max(lowIndex, values.findIndex((v) => v >= high));
                  return <div key={def.code} className="space-y-1"><span className="text-caption font-medium text-muted-foreground">{def.name}: от {low} {def.unit || ""} до {high} {def.unit || ""}</span><div className="relative h-6"><div className="absolute left-0 right-0 top-2.5 h-1 rounded bg-border" /><div className="absolute top-2.5 h-1 rounded bg-primary" style={{ left: `${(lowIndex / Math.max(1, values.length - 1)) * 100}%`, right: `${100 - (highIndex / Math.max(1, values.length - 1)) * 100}%` }} /><input aria-label={`${def.name}: от`} className="range-thumb absolute inset-0 w-full" type="range" min={0} max={values.length - 1} step={1} value={lowIndex} onChange={(e) => setFacetRanges((p) => ({ ...p, [def.code]: { ...p[def.code], min: Math.min(values[Number(e.target.value)], high) } }))} /><input aria-label={`${def.name}: до`} className="range-thumb absolute inset-0 w-full" type="range" min={0} max={values.length - 1} step={1} value={highIndex} onChange={(e) => setFacetRanges((p) => ({ ...p, [def.code]: { ...p[def.code], max: Math.max(values[Number(e.target.value)], low) } }))} /></div></div>;
                })}
                {chipGroups.map((g) => (
                  <div key={g.code} className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-caption font-medium text-muted-foreground">
                      {g.name}
                    </span>
                    {g.values.map((v) => {
                      const on = (facet[g.code] || []).includes(v.value);
                      return (
                        <button
                          key={v.value}
                          type="button"
                          onClick={() =>
                            setFacet((prev) => {
                              const next = { ...prev };
                              const values = next[g.code] || [];
                              const updated = on ? values.filter((x) => x !== v.value) : [...values, v.value];
                              if (updated.length) next[g.code] = updated;
                              else delete next[g.code];
                              return next;
                            })
                          }
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-caption font-medium transition-colors",
                            on
                              ? "border-primary bg-primary text-white"
                              : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                          )}
                        >
                          {v.label}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
          {multiQtySingle && singlePick && (
            <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-3">
              <span className="text-caption font-medium text-muted-foreground">
                Количество
              </span>
              <div className="flex items-center gap-1 rounded-md border border-input p-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSlotQty(Math.max(slot.minQty || 1, singlePick.qty - 1));
                  }}
                >
                  <Minus className="size-4" />
                </Button>
                <span className="w-8 text-center text-body-sm font-semibold">
                  {singlePick.qty}
                </span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSlotQty(Math.min(slot.maxQty, singlePick.qty + 1));
                  }}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>
          )}
          <ul className="divide-y divide-border">
            {!multi && !query.trim() && slot.options.length > 0 && (
              <li>
                <button
                  type="button"
                  onClick={() => onClear?.()}
                  className={cn(
                    "flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors",
                    picks.length === 0
                      ? "bg-primary/5"
                      : "hover:bg-secondary/60",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                      picks.length === 0
                        ? "border-primary bg-primary text-white"
                        : "border-border",
                    )}
                  >
                    {picks.length === 0 && (
                      <Check className="size-3" strokeWidth={3} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-body-sm font-semibold">
                      Не выбрано
                    </span>
                    <span className="text-caption text-muted-foreground">
                      {required ? "обязательный слот" : "пропустить"}
                    </span>
                  </span>
                  <span className="shrink-0 text-body-sm text-muted-foreground">
                    —
                  </span>
                </button>
              </li>
            )}
            {visibleOptions.map((opt) => {
              const active = selectedIds.has(opt.productId);
              const pick = picks.find((p) => p.productId === opt.productId);
              return (
                <li key={opt.productId}>
                  <div
                    className={cn(
                      "flex w-full items-start gap-3 px-5 py-3.5 transition-colors",
                      active ? "bg-primary/5" : "hover:bg-secondary/60",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => (multi ? onToggle(opt) : onSelect(opt))}
                      className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    >
                      {multi ? (
                        <span
                          className={cn(
                            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border-2",
                            active
                              ? "border-primary bg-primary text-white"
                              : "border-border",
                          )}
                        >
                          {active && <Check className="size-3" strokeWidth={3} />}
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                            active
                              ? "border-primary bg-primary text-white"
                              : "border-border",
                          )}
                        >
                          {active && <Check className="size-3" strokeWidth={3} />}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-body-sm font-semibold">
                          {opt.name || "Без названия"}
                        </span>
                      </span>
                      <span className="shrink-0 text-body-sm font-semibold tabular-nums">
                        {opt.onRequest
                          ? "Под заказ"
                           : opt.price == null
                            ? "вкл."
                            : `+${formatPrice(opt.price)}`}
                      </span>
                    </button>
                    {multi && active && slot.maxQty > 1 && pick && (
                      <div
                        className="flex shrink-0 items-center gap-0.5 rounded-md border border-input p-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() =>
                            onQty(opt.productId, Math.max(1, pick.qty - 1))
                          }
                        >
                          <Minus className="size-3.5" />
                        </Button>
                        <span className="w-6 text-center text-caption font-semibold">
                          {pick.qty}
                        </span>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() =>
                            onQty(opt.productId, pick.qty + 1)
                          }
                        >
                          <Plus className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
            {slot.options.length === 0 && (
              <li className="px-5 py-4 text-body-sm text-muted-foreground">
                Нет доступных опций
              </li>
            )}
            {slot.options.length > 0 &&
              query.trim() &&
              !slot.options.some((opt) => {
                const q = query.trim().toLowerCase();
                return (
                  opt.name.toLowerCase().includes(q) ||
                  (opt.sku || "").toLowerCase().includes(q)
                );
              }) && (
              <li className="px-5 py-4 text-body-sm text-muted-foreground">
                Ничего не найдено
              </li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}
