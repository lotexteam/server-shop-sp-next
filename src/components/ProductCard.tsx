"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Heart, ShoppingCart, GitCompare, SlidersHorizontal } from "lucide-react";
import type { Product } from "@/data/types";
import { CONDITION_LABEL, CONDITION_TONE } from "@/data/conditions";
import { formatPrice, cn } from "@/lib/utils";
import { VatHint } from "@/components/common/Price";
import { productPath } from "@/lib/api";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { StockStatus } from "./ui/stock-status";
import { useShop } from "@/store/shop";
import { useCompareAction } from "@/hooks/useCompareAction";

export function ProductCard({
  product,
  onAdd,
  onFav,
}: {
  product: Product;
  onAdd?: (p: Product) => void;
  onFav?: (p: Product) => void;
}) {
  const { favorites } = useShop();
  const { onToggleCompare, isInCompare } = useCompareAction();
  const discount =
    product.price != null && product.oldPrice != null
      ? Math.round((1 - product.price / product.oldPrice) * 100)
      : 0;
  const inCompare = isInCompare(product.id);
  const isFav =
    favorites.includes(product.id) ||
    (product.slug ? favorites.includes(product.slug) : false);

  return (
    <motion.article
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-card transition-shadow hover:shadow-card-hover"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
        <Link href={productPath(product)}>
          <img
            src={product.image}
            alt={product.title}
            width={400}
            height={300}
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </Link>
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {!product.onRequest && discount > 0 && <Badge variant="accent">-{discount}%</Badge>}
          {product.onRequest && <Badge variant="gradient">Под заказ</Badge>}
          {product.badges?.slice(0, 1).map((b) => (
            <Badge key={b} variant="gradient">
              {b}
            </Badge>
          ))}
        </div>
        <div
          className={cn(
            "absolute right-3 top-3 flex flex-col gap-1.5 transition-opacity",
            inCompare || isFav ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
        >
          <button
            type="button"
            onClick={() => onFav?.(product)}
            className={cn(
              "flex size-9 items-center justify-center rounded-full bg-card/90 shadow-sm backdrop-blur transition-colors",
              isFav ? "text-accent" : "text-muted-foreground hover:text-accent"
            )}
            aria-label="В избранное"
            aria-pressed={isFav}
          >
            <Heart className={cn("size-4", isFav && "fill-accent")} />
          </button>
          <button
            type="button"
            onClick={() => onToggleCompare(product)}
            className={cn(
              "flex size-9 items-center justify-center rounded-full bg-card/90 shadow-sm backdrop-blur transition-colors",
              inCompare ? "bg-primary text-white hover:bg-primary-600" : "text-muted-foreground hover:text-primary"
            )}
            aria-label={inCompare ? "Убрать из сравнения" : "К сравнению"}
            aria-pressed={inCompare}
          >
            <GitCompare className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("rounded-full px-2 py-0.5 text-caption font-semibold", CONDITION_TONE[product.condition])}>
            {CONDITION_LABEL[product.condition]}
          </span>
        </div>

        <Link
           href={productPath(product)}
          className="line-clamp-2 text-body font-semibold leading-snug transition-colors hover:text-primary"
        >
          {product.title}
        </Link>

        <ul className="space-y-1 text-caption text-muted-foreground">
          {product.specs.slice(0, 3).map((s) => (
            <li key={s.label} className="flex justify-between gap-2">
              <span>{s.label}</span>
              <span className="truncate font-medium text-foreground/80">{s.value}</span>
            </li>
          ))}
        </ul>

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div>
            {product.onRequest || product.price == null ? (
              <div className="text-h5 font-bold text-foreground">Под заказ</div>
            ) : (
              <>
                {product.oldPrice && (
                  <div className="text-caption text-muted-foreground line-through">{formatPrice(product.oldPrice)}</div>
                )}
                <div className="text-h5 font-bold text-foreground">{formatPrice(product.price)}</div>
                <VatHint />
              </>
            )}
          </div>
          <div className="flex gap-1.5">
            <Button
              size="icon"
              variant={inCompare ? "primary" : "outline"}
              onClick={() => onToggleCompare(product)}
              aria-label={inCompare ? "Убрать из сравнения" : "К сравнению"}
              className="hidden sm:inline-flex"
            >
              <GitCompare />
            </Button>
            {product.isReadyConfiguration && product.configuratorEdit?.slug ? (
              <Button size="icon" variant="outline" asChild aria-label="Изменить">
                <Link
                   href={`/product/${encodeURIComponent(product.configuratorEdit.slug)}?edit=${encodeURIComponent(product.slug)}`}
                >
                  <SlidersHorizontal />
                </Link>
              </Button>
            ) : null}
            <Button size="icon" variant="gradient" className="text-white" onClick={() => onAdd?.(product)} aria-label="В корзину">
              <ShoppingCart />
            </Button>
          </div>
        </div>
        <StockStatus onRequest={product.onRequest || product.price == null} />
      </div>
    </motion.article>
  );
}
