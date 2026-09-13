"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { categoryHref } from "@/lib/api";

type Chip = {
  id: string;
  slug: string;
  title: string;
};

/**
 * Catalog top subcategory chips: two rows when collapsed, «Ещё» expands the rest.
 */
export function CategoryChips({
  parentSlug,
  activeSubSlug,
  items,
}: {
  parentSlug: string;
  activeSubSlug?: string;
  items: Chip[];
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const check = () => {
      setOverflows(el.scrollHeight > el.clientHeight + 2);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items, parentSlug, expanded]);

  return (
    <div className="mt-2">
      <div
        ref={wrapRef}
        className={cn(
          "flex flex-wrap gap-2",
          !expanded && "max-h-[4.75rem] overflow-hidden",
        )}
      >
        <Link
           href={categoryHref(parentSlug)}
          className={cn(
            "rounded-full border px-3 py-1 text-caption font-semibold transition-colors",
            !activeSubSlug
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary",
          )}
        >
          Все
        </Link>
        {items.map((sub) => (
          <Link
            key={sub.id}
             href={categoryHref(sub.slug)}
            className={cn(
              "rounded-full border px-3 py-1 text-caption font-semibold transition-colors",
              activeSubSlug === sub.slug
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary",
            )}
          >
            {sub.title}
          </Link>
        ))}
      </div>
      {(overflows || expanded) && items.length > 0 ? (
        <button
          type="button"
          className="mt-2 inline-flex items-center gap-1 text-caption font-semibold text-primary hover:underline"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <>
              Свернуть <ChevronUp className="size-3.5" />
            </>
          ) : (
            <>
              Ещё <ChevronDown className="size-3.5" />
            </>
          )}
        </button>
      ) : null}
    </div>
  );
}
