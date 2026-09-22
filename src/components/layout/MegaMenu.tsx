"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Box } from "lucide-react";
import { getIcon } from "@/lib/icons";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { categoryHref } from "@/lib/api";
import { useCategories } from "@/hooks/useCategories";
import { useMenu } from "@/hooks/useMenu";

const SUB_WINDOW = 7;
const SUB_STEP = 4;

function flattenMenuSubs(
  nodes: Array<{ id: string; slug: string; title: string; children?: unknown[] }>,
  /** null — все уровни; 0 — не показывать подкатегории; N — N уровней */
  maxDepth: number | null = null,
): Array<{ id: string; slug: string; title: string }> {
  const out: Array<{ id: string; slug: string; title: string }> = [];
  if (maxDepth !== null && maxDepth <= 0) return out;
  for (const n of nodes) {
    out.push({ id: n.id, slug: n.slug, title: n.title });
    if (Array.isArray(n.children) && n.children.length) {
      out.push(
        ...flattenMenuSubs(
          n.children as Array<{ id: string; slug: string; title: string; children?: unknown[] }>,
          maxDepth === null ? null : maxDepth - 1,
        ),
      );
    }
  }
  return out;
}

function ColumnSubs({
  parentSlug,
  kids,
  onNavigate,
}: {
  parentSlug: string;
  kids: Array<{ id: string; slug: string; title: string }>;
  onNavigate?: () => void;
}) {
  const [offset, setOffset] = useState(0);
  if (!kids.length) return null;

  const maxOffset = Math.max(0, kids.length - SUB_WINDOW);
  const start = Math.min(offset, maxOffset);
  const visible = kids.slice(start, start + SUB_WINDOW);
  const canUp = start > 0;
  const canDown = start + SUB_WINDOW < kids.length;
  const remaining = kids.length - (start + visible.length);

  return (
    <div className="relative ml-4 mt-0.5 border-l border-border pl-3">
      {canUp && (
        <button
          type="button"
          className="mb-0.5 flex w-full items-center justify-center gap-1 rounded-md py-0.5 text-[11px] font-semibold text-primary hover:bg-secondary"
          onClick={() => setOffset((o) => Math.max(0, o - SUB_STEP))}
        >
          <ChevronUp className="size-3.5" />
          Назад
        </button>
      )}
      <ul
        className={cn(
          "space-y-0.5",
          canUp && "[mask-image:linear-gradient(to_bottom,transparent,black_16px)]",
        )}
      >
        {visible.map((sub) => (
          <li key={sub.id}>
            <Link
               href={categoryHref(sub.slug)}
              role="menuitem"
              onClick={onNavigate}
              className="block truncate rounded-md px-2 py-1 text-caption text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
            >
              {sub.title}
            </Link>
          </li>
        ))}
      </ul>
      {canDown && (
        <button
          type="button"
          className="mt-0.5 flex w-full items-center justify-center gap-1 rounded-md py-0.5 text-[11px] font-semibold text-primary hover:bg-secondary"
          onClick={() => setOffset((o) => Math.min(maxOffset, o + SUB_STEP))}
        >
          Ещё {remaining}
          <ChevronDown className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function MegaMenu({
  onNavigate,
  pinned = false,
  closing = false,
  /** Из GET /menus/header (subcategories_depth) — до какого уровня показывать подкатегории */
  subcategoriesDepth = null,
}: {
  onNavigate?: () => void;
  pinned?: boolean;
  /** Играет анимацию выхода: держит родитель через usePresence */
  closing?: boolean;
  subcategoriesDepth?: number | null;
}) {
  const { categories } = useCategories();
  /** CMS: GET /menus/mega — type=category | url for featured tiles */
  const { items: featured } = useMenu("mega");

  return (
    <div
      className={cn(
        "absolute left-0 top-full z-50 w-[min(56rem,calc(100vw-2rem))] pt-2",
        closing ? "menu-out" : "menu-in",
      )}
      role="menu"
      aria-label="Категории каталога"
    >
      <div
        className={cn(
          "max-h-[min(36rem,calc(100dvh-var(--chrome-h)-0.5rem))] overflow-y-auto overscroll-contain rounded-lg border border-border bg-popover p-6 shadow-elevated scrollbar-thin",
          pinned && "ring-2 ring-primary/20",
        )}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((c) => {
            const Icon = getIcon(c.icon);
            const kids = flattenMenuSubs(c.children ?? [], subcategoriesDepth);
            return (
              <div key={c.id} className="min-w-0">
                <Link
                   href={categoryHref(c.slug)}
                  role="menuitem"
                  onClick={onNavigate}
                  className="group flex items-center gap-2.5 rounded-md p-2 transition-colors hover:bg-secondary"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-gradient-soft text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-body-sm font-semibold">{c.title}</span>
                    <span className="block text-caption text-muted-foreground">
                      {kids.length ? `${kids.length} подкатег.` : "Категория"}
                    </span>
                  </span>
                </Link>
                <ColumnSubs parentSlug={c.slug} kids={kids} onNavigate={onNavigate} />
              </div>
            );
          })}
        </div>

        {featured.length > 0 && (
          <div
            className={cn(
              "mt-4 grid gap-4 border-t border-border pt-4",
              featured.length === 1 ? "grid-cols-1" : "grid-cols-2",
            )}
          >
            {featured.map((f) => (
              <Link
                key={f.id}
                 href={f.href}
                role="menuitem"
                onClick={onNavigate}
                className="flex items-center justify-between rounded-md bg-brand-gradient-soft p-4 transition-transform hover:scale-[1.01]"
              >
                <span className="min-w-0">
                  <span className="block text-body-sm font-semibold text-primary">{f.label}</span>
                  {f.description && (
                    <span className="mt-0.5 block line-clamp-2 text-caption text-muted-foreground">
                      {f.description}
                    </span>
                  )}
                </span>
                <ArrowRight className="size-4 shrink-0 text-primary" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
