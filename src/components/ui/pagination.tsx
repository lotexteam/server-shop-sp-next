"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function Pagination({ page, total, onChange, className }: { page: number; total: number; onChange?: (p: number) => void; className?: string }) {
  const pages = Array.from({ length: total }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === total || Math.abs(p - page) <= 1
  );
  const items: (number | "…")[] = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - (pages[i - 1] as number) > 1) items.push("…");
    items.push(p);
  });

  return (
    <nav className={cn("flex items-center gap-1.5", className)} aria-label="Пагинация">
      <Button variant="outline" size="icon-sm" disabled={page === 1} onClick={() => onChange?.(page - 1)} aria-label="Назад">
        <ChevronLeft />
      </Button>
      {items.map((it, i) =>
        it === "…" ? (
          <span key={`e${i}`} className="px-1.5 text-muted-foreground">…</span>
        ) : (
          <button
            key={it}
            onClick={() => onChange?.(it)}
            aria-current={it === page ? "page" : undefined}
            className={cn(
              "inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2.5 text-body-sm font-medium transition-colors",
              it === page ? "bg-primary text-primary-foreground shadow-sm" : "border border-input bg-card hover:bg-secondary"
            )}
          >
            {it}
          </button>
        )
      )}
      <Button variant="outline" size="icon-sm" disabled={page === total} onClick={() => onChange?.(page + 1)} aria-label="Вперёд">
        <ChevronRight />
      </Button>
    </nav>
  );
}
