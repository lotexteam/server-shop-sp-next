"use client";

import Link from "next/link";
import { ShoppingCart, X } from "lucide-react";
import type { Product } from "@/data/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPrice, cn } from "@/lib/utils";
import { buildCompareRows, minPriceIndex } from "@/lib/compare";
import { CONDITION_LABEL, CONDITION_TONE } from "@/data/conditions";

type Props = {
  products: Product[];
  onRemove: (id: string) => void;
  onAddToCart: (p: Product) => void;
  /** Highlight only differing rows */
  onlyDiffs?: boolean;
};

export function CompareTable({ products: items, onRemove, onAddToCart, onlyDiffs = false }: Props) {
  const rows = buildCompareRows(items).filter((r) => !onlyDiffs || r.differs);
  const cheapest = minPriceIndex(items);
  const mainRows = rows.filter((r) => r.group === "main");
  const specRows = rows.filter((r) => r.group === "specs");

  if (!items.length) return null;

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
      <table className="w-full min-w-[540px] border-collapse text-left">
        <thead>
          <tr className="border-b border-border">
            <th className="sticky left-0 z-20 w-32 bg-card p-3 text-caption font-semibold uppercase tracking-wide text-muted-foreground sm:w-40">
              Параметр
            </th>
            {items.map((p, i) => (
              <th key={p.id} className="min-w-[140px] max-w-[180px] p-3 align-top">
                <div className="relative flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => onRemove(p.id)}
                    className="absolute -right-1 -top-1 z-10 flex size-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-destructive/40 hover:text-destructive"
                    aria-label={`Убрать ${p.title} из сравнения`}
                  >
                    <X className="size-3" />
                  </button>
                  <Link
                     href={`/product/${p.slug}`}
                    className="block overflow-hidden rounded-lg border border-border bg-secondary"
                  >
                    <img
                      src={p.image}
                      alt=""
                      loading="lazy"
                      className="aspect-[16/10] w-full object-contain p-1"
                    />
                  </Link>
                  <div className="flex flex-wrap gap-1.5 pr-6">
                    {i === cheapest && <Badge variant="success">Выгоднее</Badge>}
                    <span className={cn("rounded-full px-2 py-0.5 text-caption font-semibold", CONDITION_TONE[p.condition])}>
                      {CONDITION_LABEL[p.condition]}
                    </span>
                  </div>
                  <Link
                     href={`/product/${p.slug}`}
                    className="line-clamp-2 text-body-sm font-semibold leading-snug hover:text-primary"
                  >
                    {p.title}
                  </Link>
                  <div>
                    {p.onRequest ? (
                      <div className="text-h5 font-bold">Под заказ</div>
                    ) : (
                      <>
                        {p.oldPrice && (
                          <div className="text-caption text-muted-foreground line-through">
                            {formatPrice(p.oldPrice)}
                          </div>
                        )}
                        <div className={cn("text-h5 font-bold", i === cheapest && "text-success")}>
                          {p.price == null ? "Под заказ" : formatPrice(p.price)}
                        </div>
                      </>
                    )}
                  </div>
                  <Button size="sm" variant="gradient" className="w-full" onClick={() => onAddToCart(p)}>
                    <ShoppingCart className="size-4" /> В корзину
                  </Button>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {mainRows.length > 0 && (
            <tr>
              <td
                colSpan={items.length + 1}
                className="bg-secondary/80 px-4 py-2 text-caption font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Основное
              </td>
            </tr>
          )}
          {mainRows.map((row) => (
            <tr
              key={row.key}
              className={cn(
                "border-t border-border",
                row.differs && "bg-primary/[0.03]"
              )}
            >
              <td className="sticky left-0 z-10 bg-card px-4 py-3 text-body-sm font-medium text-foreground">
                <span className="inline-flex items-center gap-2">
                  {row.label}
                  {row.differs && (
                    <span className="size-1.5 rounded-full bg-accent" title="Значения отличаются" />
                  )}
                </span>
              </td>
              {row.values.map((v, i) => (
                <td
                  key={`${row.key}-${items[i].id}`}
                  className={cn(
                    "px-4 py-3 text-body-sm",
                    row.differs ? "font-semibold text-foreground" : "text-muted-foreground"
                  )}
                >
                  {v}
                </td>
              ))}
            </tr>
          ))}

          {specRows.length > 0 && (
            <tr>
              <td
                colSpan={items.length + 1}
                className="bg-secondary/80 px-4 py-2 text-caption font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Характеристики
              </td>
            </tr>
          )}
          {specRows.map((row) => (
            <tr
              key={row.key}
              className={cn("border-t border-border", row.differs && "bg-primary/[0.03]")}
            >
              <td className="sticky left-0 z-10 bg-card px-4 py-3 text-body-sm font-medium text-foreground">
                <span className="inline-flex items-center gap-2">
                  {row.label}
                  {row.differs && (
                    <span className="size-1.5 rounded-full bg-accent" title="Значения отличаются" />
                  )}
                </span>
              </td>
              {row.values.map((v, i) => (
                <td
                  key={`${row.key}-${items[i].id}`}
                  className={cn(
                    "px-4 py-3 text-body-sm",
                    row.differs ? "font-semibold text-foreground" : "text-muted-foreground"
                  )}
                >
                  {v}
                </td>
              ))}
            </tr>
          ))}

          {onlyDiffs && rows.length === 0 && (
            <tr>
              <td colSpan={items.length + 1} className="px-4 py-10 text-center text-body-sm text-muted-foreground">
                Все параметры совпадают — различия не найдены
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
