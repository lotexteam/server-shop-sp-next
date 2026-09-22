"use client";

import { useMemo, useRef } from "react";
import Link from "next/link";
import { getIcon } from "@/lib/icons";
import { ArrowRight, ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import { Reveal } from "@/components/common/Section";
import { cn } from "@/lib/utils";
import { useCategories } from "@/hooks/useCategories";
import { useMenu } from "@/hooks/useMenu";
import { categoryHref, type MenuNavItem } from "@/lib/api";
import type { Category } from "@/data/types";

/** Visible subcategory rows before independent scroll (home cards). */
const HOME_SUBS_VISIBLE = 5;
const HOME_SUB_ROW_PX = 40;

function flattenHomeSubs(
  nodes: Array<{ id: string; slug: string; title: string; count?: number; children?: unknown[] }>,
  /** null — все уровни; 0 — не показывать подкатегории; N — N уровней */
  maxDepth: number | null = null,
): Array<{ id: string; slug: string; title: string; count: number }> {
  const out: Array<{ id: string; slug: string; title: string; count: number }> = [];
  if (maxDepth !== null && maxDepth <= 0) return out;
  for (const n of nodes) {
    out.push({ id: n.id, slug: n.slug, title: n.title, count: n.count ?? 0 });
    if (Array.isArray(n.children) && n.children.length) {
      out.push(
        ...flattenHomeSubs(
          n.children as Array<{ id: string; slug: string; title: string; count?: number; children?: unknown[] }>,
          maxDepth === null ? null : maxDepth - 1,
        ),
      );
    }
  }
  return out;
}

function findCategory(
  nodes: Category[],
  pred: (c: Category) => boolean,
): Category | undefined {
  for (const n of nodes) {
    if (pred(n)) return n;
    const kids = (n.children ?? []) as Category[];
    const hit = findCategory(kids, pred);
    if (hit) return hit;
  }
  return undefined;
}

function categorySlugFromMenuItem(item: MenuNavItem): string | null {
  if (item.categorySlug) return item.categorySlug;
  // ЧПУ /catalog/{slug} — родной формат меню; легаси ?category= тоже принимаем.
  const path = item.href.split("?")[0];
  const m = path.match(/^\/catalog\/([^/]+)\/?$/) || item.href.match(/[?&]category=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function CatalogCategories() {
  const { items: homeMenu, loading: menuLoading, subcategoriesDepth } = useMenu("home");
  const { categories, loading: catsLoading } = useCategories();

  // Плитки главной — из CMS menus/home. Пока меню пустое — fallback:
  // все корневые категории (тип category; type=url/home игнорируем).
  const tiles = useMemo(() => {
    if (homeMenu.length > 0) {
      return homeMenu
        .map((item) => {
          const slug = categorySlugFromMenuItem(item);
          const fromTree = slug
            ? findCategory(categories, (c) => c.slug === slug)
            : item.categoryId
              ? findCategory(categories, (c) => c.id === item.categoryId)
              : undefined;
          const resolvedSlug = slug || fromTree?.slug || "";
          if (!resolvedSlug) return null;
          return {
            id: fromTree?.id || item.id,
            slug: resolvedSlug,
            title: item.label || fromTree?.title || resolvedSlug,
            icon: item.icon || fromTree?.icon || "Box",
            description: item.description || fromTree?.description,
            children: fromTree?.children ?? [],
          };
        })
        .filter((t): t is NonNullable<typeof t> => Boolean(t));
    }
    return categories.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      icon: c.icon || "Box",
      description: c.description,
      children: c.children ?? [],
    }));
  }, [homeMenu, categories]);

  const loading =
    (menuLoading && homeMenu.length === 0) ||
    (homeMenu.length === 0 && catsLoading && categories.length === 0);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-xl bg-secondary" />
        ))}
      </div>
    );
  }

  if (!tiles.length) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((c, i) => {
        const Icon = getIcon(c.icon);
        const kids = flattenHomeSubs(c.children ?? [], subcategoriesDepth);

        return (
          <Reveal key={c.id} delay={i * 0.04} className="h-full">
            <article
              className={cn(
                "group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card transition-all duration-300",
                "hover:border-primary/35 hover:shadow-card-hover"
              )}
            >
              {/* Header → parent category */}
              <Link
                 href={categoryHref(c.slug)}
                className="flex items-start gap-3 border-b border-border/80 p-5 transition-colors hover:bg-secondary/40"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-brand-gradient-soft text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-body font-semibold text-foreground group-hover:text-primary">
                      {c.title}
                    </h3>
                    <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                  <p className="mt-0.5 text-caption text-muted-foreground">
                    {kids.length
                      ? `${kids.length} подкатегори${kids.length === 1 ? "я" : kids.length < 5 ? "и" : "й"}`
                      : "Категория"}
                  </p>
                  {c.description && (
                    <p className="mt-1.5 line-clamp-2 text-caption text-muted-foreground/90">
                      {c.description}
                    </p>
                  )}
                </div>
              </Link>

              {/* Subcategories: max 5 rows, own scroll like catalog chips */}
              <HomeSubcategoryList parentSlug={c.slug} kids={kids} />

              <Link
                 href={categoryHref(c.slug)}
                className="mt-auto flex items-center gap-1.5 border-t border-border/70 px-5 pb-3 pt-3 text-caption font-semibold text-primary opacity-80 transition-all hover:gap-2.5 hover:opacity-100"
              >
                Все {c.title.toLowerCase()}
                <ArrowRight className="size-3.5" />
              </Link>
            </article>
          </Reveal>
        );
      })}
    </div>
  );
}

function HomeSubcategoryList({
  parentSlug,
  kids,
}: {
  parentSlug: string;
  kids: Array<{ id: string; slug: string; title: string; count: number }>;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const canScroll = kids.length > HOME_SUBS_VISIBLE;
  const maxH = HOME_SUBS_VISIBLE * HOME_SUB_ROW_PX;

  const scrollByRow = (dir: -1 | 1) => {
    listRef.current?.scrollBy({ top: dir * HOME_SUB_ROW_PX, behavior: "smooth" });
  };

  return (
    <div className="flex flex-1 flex-col p-3 pt-2">
      <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Подкатегории
        </p>
        {canScroll ? (
          <span className="flex items-center gap-0.5">
            <button
              type="button"
              aria-label="Пролистать вверх"
              className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
              onClick={() => scrollByRow(-1)}
            >
              <ChevronUp className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="Пролистать вниз"
              className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
              onClick={() => scrollByRow(1)}
            >
              <ChevronDown className="size-3.5" />
            </button>
          </span>
        ) : null}
      </div>
      {kids.length === 0 ? (
        <p className="px-2.5 py-2 text-caption text-muted-foreground">Нет подкатегорий</p>
      ) : (
        <ul
          ref={listRef}
          className={cn(
            "flex flex-col gap-0.5 overscroll-contain scrollbar-thin",
            canScroll && "overflow-y-auto",
          )}
          style={canScroll ? { maxHeight: maxH } : undefined}
        >
          {kids.map((sub) => (
            <li key={sub.id} className="shrink-0" style={{ height: HOME_SUB_ROW_PX - 2 }}>
              <Link
                 href={categoryHref(sub.slug)}
                className="flex h-full items-center justify-between gap-2 rounded-md px-2.5 text-body-sm transition-colors hover:bg-secondary hover:text-primary"
              >
                <span className="truncate font-medium">{sub.title}</span>
                <span className="shrink-0 tabular-nums text-caption text-muted-foreground">
                  {sub.count}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
