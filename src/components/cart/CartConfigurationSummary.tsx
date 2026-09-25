"use client";

import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import type { CartLine } from "@/store/shop";
import { formatConfigurationLine, getConfigurationLines } from "@/lib/configuration";

function editHref(line: CartLine): string | null {
  const readySlug = line.product.configuratorEdit?.slug;
  if (line.product.isReadyConfiguration && readySlug) {
    return `/product/${encodeURIComponent(readySlug)}?edit=${encodeURIComponent(line.product.slug)}`;
  }
  if (line.build?.selections?.length && line.product.slug) {
    const id = line.lineKey || `${line.product.id}:cfg`;
    return `/product/${encodeURIComponent(line.product.slug)}?config=${encodeURIComponent(id)}`;
  }
  return null;
}

export function CartConfigurationSummary({ line }: { line: CartLine }) {
  const rows = getConfigurationLines(line.product);
  const href = editHref(line);

  if (!(line.build || line.priceKind === "configurator" || line.product.isReadyConfiguration) || rows.length === 0) return null;

  return (
    <div className="mt-2 w-full min-w-0 max-w-full overflow-hidden rounded-md border border-border/70 bg-secondary/30 px-2.5 py-2">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <p className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Состав конфигурации</p>
        {href ? (
          <Link
            href={href}
            className="inline-flex shrink-0 items-center gap-1 text-caption font-semibold text-primary hover:underline"
          >
            <SlidersHorizontal className="size-3.5" /> Изменить
          </Link>
        ) : null}
      </div>
      <ul className="mt-1 w-full min-w-0 space-y-1 text-caption text-muted-foreground">
        {rows.map((row, index) => (
          <li key={`${row.slot}-${index}`} className="flex min-w-0 items-center gap-1 whitespace-nowrap">
            <span className="min-w-0 flex-1 truncate" title={formatConfigurationLine(row)}>
              <span className="text-muted-foreground/75">{row.slot}:</span> {row.name}
            </span>
            <span className="shrink-0 tabular-nums">x {row.qty}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
