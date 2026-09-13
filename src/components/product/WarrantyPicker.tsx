"use client";

import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils";
import type { WarrantyOption } from "@/lib/api";

type Props = {
  options: WarrantyOption[];
  loading?: boolean;
  selectedTermId: string | null;
  onSelect: (opt: WarrantyOption | null) => void;
  className?: string;
};

export function WarrantyPicker({
  options,
  loading,
  selectedTermId,
  onSelect,
  className,
}: Props) {
  if (!loading && options.length === 0) return null;

  const paid = options.filter((o) => o.isPaid);
  const base = options.filter((o) => !o.isPaid);
  const selected = options.find((o) => o.termId === selectedTermId) || null;
  const notes = selected?.notes?.length
    ? selected.notes
    : selected?.excludes?.map((e) => e.note).filter(Boolean) || [];

  return (
    <div className={cn("rounded-lg border border-border bg-card p-4", className)}>
      <p className="flex items-center gap-2 text-body-sm font-semibold">
        <ShieldCheck className="size-4 text-primary" />
        Гарантия
      </p>
      {loading && options.length === 0 ? (
        <p className="mt-2 text-caption text-muted-foreground">Считаем варианты…</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {base.map((opt) => {
            const active = selectedTermId === opt.termId;
            return (
              <li key={opt.termId}>
                <button
                  type="button"
                  onClick={() => onSelect(opt)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-md border px-3 py-2.5 text-left transition-colors",
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-secondary/60",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                      active ? "border-primary bg-primary" : "border-border",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-body-sm font-medium">{opt.name}</span>
                    <span className="text-caption text-muted-foreground">
                      {opt.months ? `${opt.months} мес. · включена` : "Базовая · включена"}
                    </span>
                  </span>
                  <span className="text-body-sm font-semibold text-muted-foreground">0 ₽</span>
                </button>
              </li>
            );
          })}
          {paid.map((opt) => {
            const active = selectedTermId === opt.termId;
            const extra =
              opt.markupPercent != null
                ? `+${Math.round(opt.markupPercent)}%`
                : null;
            return (
              <li key={opt.termId}>
                <button
                  type="button"
                  onClick={() => onSelect(opt)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-md border px-3 py-2.5 text-left transition-colors",
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-secondary/60",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                      active ? "border-primary bg-primary" : "border-border",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-body-sm font-medium">{opt.name}</span>
                    <span className="text-caption text-muted-foreground">
                      {[
                        opt.months ? `${opt.months} мес.` : null,
                        extra,
                        opt.coverageBase
                          ? `база ${formatPrice(opt.coverageBase)}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="shrink-0 text-body-sm font-semibold tabular-nums">
                    +{formatPrice(opt.price)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {notes.length > 0 && (
        <p className="mt-2 text-caption text-muted-foreground">{notes.join(" ")}</p>
      )}
    </div>
  );
}

export function toCartWarranty(opt: WarrantyOption | null) {
  if (!opt || !opt.isPaid || opt.price <= 0 || !opt.snapshot) return undefined;
  return {
    termId: opt.termId,
    packageId: opt.packageId,
    name: opt.lineName || opt.name,
    price: opt.price,
    months: opt.months,
    isPaid: true as const,
    snapshot: opt.snapshot,
    serviceProductId: opt.serviceProductId,
  };
}
