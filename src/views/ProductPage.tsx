"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ShieldCheck, Truck, Wrench, Heart, GitCompare, Minus, Plus, FileText, SlidersHorizontal } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StockStatus } from "@/components/ui/stock-status";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert } from "@/components/ui/alert";
import { Table, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { ProductCard } from "@/components/ProductCard";
import { ZoomableProductImage } from "@/components/product/ZoomableProductImage";
import { Section, SectionHeader } from "@/components/common/Section";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfigurableProductView } from "@/components/configurator/ConfigurableProductView";
import { CONDITION_LABEL, CONDITION_TONE } from "@/data/conditions";
import { formatPrice, cn } from "@/lib/utils";
import { VatHint } from "@/components/common/Price";
import { useShop } from "@/store/shop";
import { useToast } from "@/components/ui/toast";
import { useCompareAction } from "@/hooks/useCompareAction";
import { fetchProduct, fetchProducts, categoryHref } from "@/lib/api";
import type { Category, Product } from "@/data/types";
import { useCategories } from "@/hooks/useCategories";
import { NotFoundPage } from "./NotFoundPage";
import { WarrantyPicker, toCartWarranty } from "@/components/product/WarrantyPicker";
import { useWarrantyOptions } from "@/hooks/useWarrantyOptions";
import { detail as metricaDetail, toMetricaProduct } from "@/lib/analytics/metrica";

export function ProductPage({ initialProduct }: { initialProduct?: Product | null }) {
  const routeParams = useParams();
  const slug = typeof routeParams.slug === "string" ? routeParams.slug : undefined;
  // SSR-товар: H1/цена/характеристики рендерятся сразу в HTML (без скелета).
  const [product, setProduct] = useState<Product | null | undefined>(initialProduct ?? undefined);
  const [related, setRelated] = useState<Product[]>([]);
  const [compatible, setCompatible] = useState<Product[]>([]);

  useEffect(() => {
    if (!slug) {
      setProduct(null);
      return;
    }
    let cancelled = false;
    // SSR уже отдал тот же slug: первый экран отрендерен, сам товар не
    // перезапрашиваем (лишний API-запрос и мигание), но related/compatible
    // и ecommerce-метрику догружаем как раньше.
    const ssrProduct =
      initialProduct != null && initialProduct.slug === slug ? initialProduct : null;
    // Soft platform switch: keep current configurable product shell so the page
    // does not remount / flash skeleton (child loads new cfg in place).
    const softPlatform =
      product?.isConfigurable &&
      product.slug !== slug;
    if (!ssrProduct && !softPlatform) {
      setProduct(undefined);
    }
    void (async () => {
      const p = ssrProduct ?? (await fetchProduct(slug));
      if (cancelled) return;
      if (!ssrProduct) setProduct(p);
      // Ecommerce: product detail view.
      if (p) metricaDetail(toMetricaProduct(p));
      if (!p) return;
      try {
        const primaryCategory = p.categorySlugs?.[0] || p.category || undefined;
        const res = await fetchProducts({
          per_page: 5,
          ...(primaryCategory ? { category_id: primaryCategory } : {}),
        });
        if (cancelled) return;
        // Платформы — только из API configurator.platforms (admin merge).
        setRelated(
          res.items
            .filter(
              (x) =>
                x.id !== p.id &&
                !x.slug.startsWith("cfg-opt-") &&
                !x.isConfigurable,
            )
            .slice(0, 4),
        );
        setCompatible(
          res.items
            .filter((x) => x.id !== p.id && !x.slug.startsWith("cfg-opt-"))
            .slice(0, 4),
        );
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- product only for softPlatform hint
  }, [slug]);

  // Configurable: keep view mounted across soft platform slug changes
  if (product?.isConfigurable) {
    return <ConfigurableProductView product={product} />;
  }

  if (product === undefined) {
    return (
      <div className="container-page py-10">
        <Skeleton className="mb-6 h-6 w-48" />
        <div className="grid gap-8 lg:grid-cols-2">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) return <NotFoundPage />;

  return <ReadyProductPage product={product} related={related} compatible={compatible} />;
}

function ReadyProductPage({
  product,
  related,
  compatible,
}: {
  product: Product;
  related: Product[];
  compatible: Product[];
}) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const { addToCart, toggleFav, favorites } = useShop();
  const { push } = useToast();
  const { onToggleCompare, isInCompare } = useCompareAction();
  const { options: warrantyOptions, loading: warrantyLoading } =
    useWarrantyOptions(product.id || product.slug);
  const [warrantyTermId, setWarrantyTermId] = useState<string | null>(null);
  const warrantyChoice =
    warrantyOptions.find((o) => o.termId === warrantyTermId) ||
    warrantyOptions.find((o) => !o.isPaid) ||
    null;
  const warrantyExtra = warrantyChoice?.isPaid ? warrantyChoice.price : 0;

  useEffect(() => {
    if (!warrantyOptions.length) return;
    if (warrantyTermId && warrantyOptions.some((o) => o.termId === warrantyTermId)) {
      return;
    }
    const base = warrantyOptions.find((o) => !o.isPaid);
    setWarrantyTermId(base?.termId ?? warrantyOptions[0]?.termId ?? null);
  }, [warrantyOptions, warrantyTermId]);

  // Цепочка категорий товара для крошек: Каталог → корень → … → подкатегория
  const { categories } = useCategories();
  const categoryChain = useMemo(() => {
    const slugs = product.categorySlugs ?? [];
    if (slugs.length === 0) return [];
    let found: Array<{ slug: string; title: string }> = [];
    const walk = (
      nodes: Category[],
      trail: Array<{ slug: string; title: string }>,
    ): boolean => {
      for (const n of nodes) {
        const next = [...trail, { slug: n.slug, title: n.title }];
        if (slugs.includes(n.slug)) {
          found = next;
          // Категория товара может лежать глубже по ветке — ищем самую глубокую
          if (n.children?.length && walk(n.children as Category[], next)) return true;
          return true;
        }
        if (n.children?.length && walk(n.children as Category[], next)) return true;
      }
      return false;
    };
    walk(categories, []);
    return found;
  }, [categories, product.categorySlugs]);

  const gallery =
    product.images && product.images.length > 0
      ? product.images
      : [product.image];
  const discount = product.price != null && product.oldPrice != null
    ? Math.round((1 - product.price / product.oldPrice) * 100)
    : 0;
  const isFav =
    favorites.includes(product.id) ||
    (product.slug ? favorites.includes(product.slug) : false);
  const inCompare = isInCompare(product.id);

  const add = () => {
    const w = toCartWarranty(warrantyChoice);
    addToCart(product, qty, { warranty: w });
    const extra = w ? w.price * qty : 0;
    push({
      variant: "success",
      title: "Добавлено в корзину",
      description: `${product.title} × ${qty} · ${formatPrice((product.price ?? 0) * qty + extra)}`,
      action: { label: "Перейти к оформлению", onClick: () => router.push("/checkout") },
    });
  };

  return (
    <div className="container-page py-6 lg:py-8">
      <Breadcrumbs
        items={[
          { label: "Каталог", href: "/catalog" },
          // Цепочка категорий товара: Каталог → … → подкатегория (плоские ЧПУ)
          ...categoryChain.map((c) => ({
            label: c.title,
            href: categoryHref(c.slug),
          })),
          { label: product.title },
        ]}
        className="mb-5"
      />
      {/* Лайтбокс внутри ZoomableProductImage */}

      {/* Фото + квадратные миниатюры; текст по высоте фото-блока */}
      <div className="grid gap-5 lg:grid-cols-[auto_1fr] lg:items-start lg:gap-6">
        <div className="flex w-full max-w-[min(100%,26rem)] flex-row items-start gap-2.5">
          <ZoomableProductImage
            images={gallery}
            index={activeImg}
            onIndex={setActiveImg}
            alt={product.title}
            title={product.title}
            className="size-[min(100%,22.4rem)] w-full max-w-[calc(100%-4.5rem)] shrink-0 aspect-square rounded-lg border border-border bg-card sm:size-[22.4rem] sm:max-w-none"
            imgClassName="size-full object-contain"
          >
            {discount > 0 && (
              <Badge variant="accent" className="absolute left-4 top-4">
                -{discount}%
              </Badge>
            )}
          </ZoomableProductImage>
          {/* Квадратные миниатюры справа */}
          <div className="flex shrink-0 flex-col gap-2">
            {gallery.map((g, i) => (
              <button
                key={i}
                onClick={() => setActiveImg(i)}
                className={cn(
                  "size-16 shrink-0 overflow-hidden rounded-md border-2 bg-card transition-colors sm:size-[4.5rem]",
                  activeImg === i ? "border-primary" : "border-border hover:border-primary/40",
                )}
              >
                <img src={g} alt="" className="size-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-col justify-between gap-3 lg:min-h-[22.4rem]">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-caption font-semibold",
                  CONDITION_TONE[product.condition],
                )}
              >
                {CONDITION_LABEL[product.condition]}
              </span>
            </div>
            <h1 className="text-h2 leading-tight">{product.title}</h1>
            <p className="text-body-sm text-muted-foreground">
              {[
                product.sku || product.slug ? `Артикул: ${product.sku || product.slug}` : "",
                product.brand?.trim() ? `Бренд: ${product.brand}` : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <div className="flex flex-wrap gap-2">
              {product.badges?.map((b) => (
                <Badge key={b} variant="gradient">
                  {b}
                </Badge>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 shadow-card sm:p-5">
            <div className="flex min-w-0 flex-wrap items-end gap-x-3 gap-y-1">
              {product.onRequest || product.price == null ? (
                <span className="block text-h1 font-bold leading-tight">Под заказ</span>
              ) : (
                <span className="min-w-0">
                  <span className="block min-w-0 break-words text-h1 font-bold tabular-nums leading-tight">
                    {formatPrice((product.price ?? 0) + warrantyExtra)}
                  </span>
                  <VatHint />
                </span>
              )}
              {!product.onRequest && product.oldPrice && (
                <span className="mb-1.5 text-h5 text-muted-foreground line-through tabular-nums">
                  {formatPrice(product.oldPrice)}
                </span>
              )}
            </div>
            <StockStatus
              onRequest={product.onRequest || product.price == null}
              className="mt-1 text-body-sm"
            />

            <div className="mt-3 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
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
                onClick={add}
              >
                <span className="inline-flex max-w-full flex-wrap items-center justify-center gap-x-1.5">
                  <span>В корзину</span>
                  {!product.onRequest && product.price != null && (
                    <span className="tabular-nums">
                      · {formatPrice((product.price + warrantyExtra) * qty)}
                    </span>
                  )}
                </span>
              </Button>
            </div>
            {!warrantyLoading && warrantyOptions.some((o) => o.isPaid) ? (
              <WarrantyPicker
                className="mt-3"
                options={warrantyOptions}
                loading={warrantyLoading}
                selectedTermId={warrantyTermId}
                onSelect={(opt) => setWarrantyTermId(opt?.termId ?? null)}
              />
            ) : null}
            {product.isReadyConfiguration && product.configuratorEdit?.slug ? (
              <Button
                size="lg"
                variant="outline"
                className="mt-2.5 h-auto min-h-12 w-full"
                onClick={() => {
                  const edit = product.configuratorEdit!;
                  router.push(
                    `/product/${encodeURIComponent(edit.slug)}?edit=${encodeURIComponent(product.slug)}`,
                  );
                }}
              >
                <SlidersHorizontal className="size-4" />
                Изменить
              </Button>
            ) : null}
            <div className="mt-2.5 flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  toggleFav(product);
                  push({ variant: "info", title: "Избранное обновлено" });
                }}
              >
                <Heart className={cn("size-4", isFav && "fill-accent text-accent")} />{" "}
                {isFav ? "В избранном" : "В избранное"}
              </Button>
              <Button
                variant={inCompare ? "primary" : "outline"}
                className="flex-1"
                onClick={() => onToggleCompare(product)}
              >
                <GitCompare className="size-4" />
                {inCompare ? "В сравнении" : "Сравнить"}
              </Button>
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

      <div className="mt-12">
        <Tabs defaultValue="specs">
          <TabsList className="relative z-10 flex h-auto w-full max-w-full justify-start">
            <TabsTrigger value="specs">Характеристики</TabsTrigger>
            {product.description ? (
              <TabsTrigger value="desc">Описание</TabsTrigger>
            ) : null}
            {(product.documents?.length ?? 0) > 0 ? (
              <TabsTrigger value="docs">Документация</TabsTrigger>
            ) : null}
          </TabsList>

          <TabsContent value="specs">
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
              <div className="surface-card overflow-hidden">
                <Table>
                  <TableBody>
                    {product.isReadyConfiguration && (product.composition?.length ?? 0) > 0
                      ? [
                          <TableRow key="kit-h">
                            <TableCell colSpan={2} className="text-body-sm font-semibold text-foreground">
                              Состав комплекта
                            </TableCell>
                          </TableRow>,
                          ...product.composition!.map((row, i) => (
                            <TableRow key={`kit-${i}`}>
                              <TableCell className="w-1/2 text-muted-foreground">{row.slot}</TableCell>
                              <TableCell className="font-medium">
                                {row.name} x {row.qty}
                              </TableCell>
                            </TableRow>
                          )),
                          <TableRow key="spec-h">
                            <TableCell colSpan={2} className="text-body-sm font-semibold text-foreground">
                              Характеристики
                            </TableCell>
                          </TableRow>,
                        ]
                      : null}
                    {[
                      ...product.specs,
                      ...(product.brand?.trim()
                        ? [{ label: "Производитель", value: product.brand }]
                        : []),
                      { label: "Состояние", value: CONDITION_LABEL[product.condition] },
                      ...(product.warranty
                        ? [{ label: "Гарантия", value: product.warranty.label }]
                        : []),
                    ].map((s, i) => (
                      <TableRow key={`spec-${i}`}>
                        <TableCell className="w-1/2 text-muted-foreground">{s.label}</TableCell>
                        <TableCell className="font-medium">{s.value}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Alert variant="info" title="Совет инженера">
                Перед покупкой уточните совместимость с вашей платформой — наши специалисты
                помогут подобрать комплектующие.
              </Alert>
            </div>
          </TabsContent>

          {product.description ? (
          <TabsContent value="desc">
            <div className="prose max-w-3xl space-y-4 text-body text-muted-foreground whitespace-pre-wrap">
              {product.description}
            </div>
          </TabsContent>
          ) : null}

          {(product.documents?.length ?? 0) > 0 ? (
          <TabsContent value="docs">
            <div className="grid max-w-3xl gap-3 sm:grid-cols-2">
              {product.documents!.map((d) => (
                <a
                  key={d.url}
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/40"
                >
                  <span className="flex size-10 items-center justify-center rounded-md bg-brand-gradient-soft text-primary">
                    <FileText className="size-5" />
                  </span>
                  <span className="text-body-sm font-medium">{d.name}</span>
                </a>
              ))}
            </div>
          </TabsContent>
          ) : null}
        </Tabs>
      </div>

      {compatible.length > 0 && (
        <Section className="!px-0">
          <SectionHeader eyebrow="Дополните" title="Совместимые товары" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {compatible.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </Section>
      )}

      {related.length > 0 && (
        <Section className="!px-0 !pt-0">
          <SectionHeader eyebrow="Похожее" title="Похожие товары" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
