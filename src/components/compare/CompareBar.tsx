"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { GitCompare, X, ArrowRight, Trash2 } from "lucide-react";
import { useShop, MAX_COMPARE } from "@/store/shop";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resolveProductsByIds } from "@/hooks/useCatalogProducts";
import type { Product } from "@/data/types";

export function CompareBar() {
  const { compare, removeFromCompare, clearCompare } = useShop();
  const pathname = usePathname();
  const [items, setItems] = useState<Product[]>([]);
  const onComparePage = pathname.includes("/compare");
  const visible = compare.length > 0 && !onComparePage;

  useEffect(() => {
    let cancelled = false;
    void resolveProductsByIds(compare).then((list) => {
      if (!cancelled) setItems(list);
    });
    return () => {
      cancelled = true;
    };
  }, [compare]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="pointer-events-none fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4"
        >
          <div className="pointer-events-auto mx-auto flex max-w-4xl flex-col gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-elevated backdrop-blur-lg sm:flex-row sm:items-center sm:gap-4 sm:p-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="hidden size-11 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white sm:flex">
                <GitCompare className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-body-sm font-semibold">
                  Сравнение{" "}
                  <span className="text-muted-foreground">
                    {items.length} / {MAX_COMPARE}
                  </span>
                </p>
                <div className="mt-2 flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
                  {items.map((p) => (
                    <div
                      key={p.id}
                      className="relative shrink-0 overflow-hidden rounded-lg border border-border bg-secondary"
                    >
                      <img src={p.image} alt="" className="size-12 object-cover sm:size-14" />
                      <button
                        type="button"
                        onClick={() => removeFromCompare(p.id)}
                        className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-card/95 text-muted-foreground shadow-sm hover:text-destructive"
                        aria-label={`Убрать ${p.title}`}
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                  {Array.from({ length: Math.max(0, MAX_COMPARE - items.length) }).map((_, i) => (
                    <div
                      key={`empty-${i}`}
                      className={cn(
                        "flex size-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-caption text-muted-foreground sm:size-14",
                      )}
                    >
                      +
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={clearCompare}
              >
                <Trash2 className="size-4" />
                <span className="hidden sm:inline">Очистить</span>
              </Button>
              <Button asChild size="sm" variant="gradient" disabled={items.length < 2}>
                <Link href="/account/compare">
                  Сравнить
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
          {items.length === 1 && (
            <p className="mt-2 text-center text-caption text-white/90 drop-shadow-sm sm:text-muted-foreground sm:drop-shadow-none">
              <span className="rounded-full bg-foreground/80 px-3 py-1 text-white sm:bg-transparent sm:px-0 sm:text-muted-foreground">
                Добавьте ещё товар — минимум 2 для сравнения
              </span>
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
