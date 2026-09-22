"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Search } from "@/components/ui/search";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { CONDITION_LABEL } from "@/data/conditions";
import type { Category, ConditionGrade } from "@/data/types";
import type { CatalogFilterAttr } from "@/lib/api";
import { cn } from "@/lib/utils";

const conditions: ConditionGrade[] = ["new", "used"];

type CatNode = {
  id: string;
  slug: string;
  title: string;
  children?: CatNode[];
};

function treeHasChecked(
  node: { slug: string; children?: readonly unknown[] },
  checked: string[],
): boolean {
  if (checked.includes(node.slug)) return true;
  return ((node.children ?? []) as Array<{ slug: string; children?: readonly unknown[] }>).some(
    (ch) => treeHasChecked(ch, checked),
  );
}

function categoryTitleMatches(title: string, q: string) {
  return title.toLowerCase().includes(q);
}

function filterCategoryTree(nodes: Category[], rawQuery: string): Category[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return nodes;

  const walk = (list: CatNode[]): CatNode[] => {
    const out: CatNode[] = [];
    for (const n of list) {
      const kids = walk((n.children ?? []) as CatNode[]);
      if (categoryTitleMatches(n.title, q)) {
        out.push(n);
      } else if (kids.length) {
        out.push({ ...n, children: kids });
      }
    }
    return out;
  };

  return walk(nodes) as Category[];
}

export interface Filters {
  categories: string[];
  /** ID брендов (не названия) — прямая отправка в filter[brand_id] */
  brands: string[];
  conditions: ConditionGrade[];
  attributes: Record<string, string[]>;
  attributeRanges: Record<string, { min?: number; max?: number }>;
}

function FilterCategoryRow({
  node,
  depth,
  checked,
  onToggle,
}: {
  node: { id: string; slug: string; title: string; children?: Array<{ id: string; slug: string; title: string; children?: unknown[] }> };
  depth: number;
  checked: string[];
  onToggle: (slug: string) => void;
}) {
  const kids = (node.children ?? []) as Array<{ id: string; slug: string; title: string; children?: unknown[] }>;
  const hasKids = kids.length > 0;
  const childSelected = useMemo(() => kids.some((ch) => treeHasChecked(ch, checked)), [kids, checked]);
  // Раскрытие — только по клику на стрелку; ветка с выбранным ребёнком
  // раскрывается сама, но её можно свернуть вручную.
  const [pinned, setPinned] = useState(childSelected);
  const open = hasKids && pinned;

  useEffect(() => {
    if (childSelected) setPinned(true);
  }, [childSelected]);

  return (
    <div className="space-y-2">
      <div
        className="flex items-center gap-0.5"
        style={depth ? { marginLeft: `${depth * 1.25}rem` } : undefined}
      >
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
          <Checkbox checked={checked.includes(node.slug)} onCheckedChange={() => onToggle(node.slug)} />
          <span className={depth ? "min-w-0 flex-1 truncate text-body-sm text-muted-foreground" : "min-w-0 flex-1 text-body-sm"}>
            {node.title}
          </span>
        </label>
        {hasKids && (
          <button
            type="button"
            className="flex size-7 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
            aria-expanded={open}
            aria-label={open ? "Свернуть подкатегории" : "Показать подкатегории"}
            onClick={() => setPinned((v) => !v)}
          >
            <ChevronDown className={cn("size-3.5 transition-transform duration-150", open && "rotate-180")} />
          </button>
        )}
      </div>
      {hasKids && (
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-150",
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div
            className={cn(
              "min-h-0",
              open && kids.length > 12
                ? "max-h-56 overflow-y-auto overscroll-contain"
                : "overflow-hidden",
            )}
          >
            {kids.map((ch) => (
              <FilterCategoryRow
                key={ch.id}
                node={ch as { id: string; slug: string; title: string; children?: Array<{ id: string; slug: string; title: string; children?: unknown[] }> }}
                depth={depth + 1}
                checked={checked}
                onToggle={onToggle}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function FilterSidebar({
  filters,
  onChange,
  onReset,
  categories = [],
  brands = [],
  facets = [],
  facetsLoading = false,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  onReset: () => void;
  categories?: Category[];
  /** Справочник брендов витрины: id + название */
  brands?: Array<{ id: string; name: string }>;
  /** Умные фасеты: считаются с текущими критериями каталога */
  facets?: CatalogFilterAttr[];
  facetsLoading?: boolean;
}) {
  const [categoryQuery, setCategoryQuery] = useState("");

  const visibleCategories = useMemo(
    () => filterCategoryTree(categories, categoryQuery),
    [categories, categoryQuery],
  );

  /**
   * Группировка атрибутов по категориям: когда область каталога —
   * родительская категория, бэкенд помечает блоки category_id/category_name
   * и упорядочивает их «как в категориях». Порядок групп — по первому
   * вхождению (порядок ответа), общие блоки (без category_id) — без
   * заголовка, выше групп.
   */
  const facetGroups = useMemo(() => {
    const groups: Array<{ key: string; name: string | null; facets: CatalogFilterAttr[] }> = [];
    const byKey = new Map<string, (typeof groups)[number]>();

    for (const facet of facets) {
      const key = facet.category_id ?? "";
      let group = byKey.get(key);
      if (!group) {
        group = { key, name: facet.category_name ?? null, facets: [] };
        byKey.set(key, group);
        groups.push(group);
      }
      group.facets.push(facet);
    }

    return groups;
  }, [facets]);

  /** Есть ли под заголовком категории что показывать (хотя бы один атрибут со значениями). */
  const groupHasAttrs = (list: CatalogFilterAttr[]) =>
    list.some(
      (a) =>
        (a.values?.length ?? 0) > 0 ||
        (a.filter_mode === "numeric" && (a.min != null || a.max != null)),
    );

  const toggle = <K extends keyof Filters>(key: K, value: string) => {
    const arr = filters[key] as string[];
    const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
    onChange({ ...filters, [key]: next });
  };

  const toggleAttr = (code: string, value: string) => {
    const cur = filters.attributes[code] ?? [];
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    const attributes = { ...filters.attributes };
    if (next.length) attributes[code] = next;
    else delete attributes[code];
    onChange({ ...filters, attributes });
  };

  const setRange = (code: string, bound: "min" | "max", value: number | undefined) => {
    const current = filters.attributeRanges[code] || {};
    const next = { ...current, [bound]: value };
    if (next.min == null && next.max == null) {
      const attributeRanges = { ...filters.attributeRanges };
      delete attributeRanges[code];
      onChange({ ...filters, attributeRanges });
    } else onChange({ ...filters, attributeRanges: { ...filters.attributeRanges, [code]: next } });
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between pb-2">
        <h3 className="text-h6">Фильтры</h3>
        <Button variant="link" size="sm" className="h-auto p-0" onClick={onReset}>
          Сбросить
        </Button>
      </div>

      <Accordion
        type="multiple"
        // Категории всегда свёрнуты по умолчанию — раскрытие по клику.
        defaultValue={["price", "brand", "cond"]}
      >
        <AccordionItem value="cat">
          <AccordionTrigger>Категория</AccordionTrigger>
          <AccordionContent>
            <Search
              value={categoryQuery}
              onChange={(e) => setCategoryQuery(e.target.value)}
              onClear={() => setCategoryQuery("")}
              placeholder="Поиск категории…"
              className="h-9"
              containerClassName="mb-3"
            />
            <div className="space-y-2">
              {visibleCategories.map((c) => (
                <FilterCategoryRow
                  key={c.id}
                  node={c}
                  depth={0}
                  checked={filters.categories}
                  onToggle={(slug) => toggle("categories", slug)}
                />
              ))}
              {categories.length === 0 && (
                <p className="text-caption text-muted-foreground">Загрузка…</p>
              )}
              {categories.length > 0 && visibleCategories.length === 0 && (
                <p className="text-caption text-muted-foreground">Ничего не найдено</p>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="price">
          <AccordionTrigger>Цена, ₽</AccordionTrigger>
          <AccordionContent>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="от"
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-body-sm focus-visible:border-primary focus-visible:outline-none"
              />
              <span className="text-muted-foreground">—</span>
              <input
                type="number"
                placeholder="до"
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-body-sm focus-visible:border-primary focus-visible:outline-none"
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Бренды: блок скрыт, пока справочник пуст (не дразним «Загрузкой…») */}
        {brands.length > 0 && (
          <AccordionItem value="brand">
            <AccordionTrigger>Производитель</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                {brands.map((b) => (
                  <label key={b.id} className="flex cursor-pointer items-center gap-2.5">
                    <Checkbox
                      checked={filters.brands.includes(b.id)}
                      onCheckedChange={() => toggle("brands", b.id)}
                    />
                    <span className="text-body-sm">{b.name}</span>
                  </label>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        <AccordionItem value="cond">
          <AccordionTrigger>Состояние</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              {conditions.map((c) => (
                <label key={c} className="flex cursor-pointer items-center gap-2.5">
                  <Checkbox
                    checked={filters.conditions.includes(c)}
                    onCheckedChange={() => toggle("conditions", c)}
                  />
                  <span className="text-body-sm">{CONDITION_LABEL[c]}</span>
                </label>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {facetGroups.map((group) => (
          <Fragment key={group.key || "attr-general"}>
            {/* Заголовок категории без атрибутов (пусто) не показываем */}
            {group.name && groupHasAttrs(group.facets) && (
              <div className="border-t border-border px-1 pb-1 pt-4 text-body-sm font-semibold text-foreground">
                {group.name}
              </div>
            )}
            {group.facets.map((attr) => {
              // Блок-«призрак»: пропал из ответа после сужения фильтров.
              const blockInactive = attr.inactive === true;
              return (
          <AccordionItem key={attr.code} value={`attr-${attr.code}`}>
            <AccordionTrigger className={cn("text-body-sm font-medium", blockInactive && "opacity-60")}>
              {attr.category && !attr.category_id ? `${attr.name} (${attr.category})` : attr.name}
            </AccordionTrigger>
            <AccordionContent>
              <div className={cn("space-y-3", blockInactive && "opacity-60")}>
                {attr.filter_mode === "numeric" && attr.min != null && attr.max != null ? (() => {
                  const range = filters.attributeRanges[attr.code] || {};
                  const values = (attr.values ?? []).map((v) => Number(v.value)).filter(Number.isFinite).sort((a, b) => a - b).filter((v, i, a) => i === 0 || v !== a[i - 1]);
                  const points = values.length > 1 ? values : [attr.min!, attr.max!];
                  const min = range.min ?? points[0];
                  const max = range.max ?? points[points.length - 1];
                  const lowIndex = Math.max(0, points.findIndex((v) => v >= min));
                  const highIndex = Math.max(lowIndex, points.findIndex((v) => v >= max));
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-caption">
                        <span>от {min} {attr.unit || ""}</span><span className="text-muted-foreground">до</span><span>{max} {attr.unit || ""}</span>
                      </div>
                      <div className="relative h-6">
                        <div className="absolute left-0 right-0 top-2.5 h-1 rounded bg-border" />
                        <div className="absolute top-2.5 h-1 rounded bg-primary" style={{ left: `${(lowIndex / Math.max(1, points.length - 1)) * 100}%`, right: `${100 - (highIndex / Math.max(1, points.length - 1)) * 100}%` }} />
                        <input aria-label={`${attr.name}: от`} type="range" min={0} max={points.length - 1} step={1} value={lowIndex} disabled={blockInactive} onChange={(e) => setRange(attr.code, "min", Math.min(points[Number(e.target.value)], max))} className="range-thumb absolute inset-0 w-full" />
                        <input aria-label={`${attr.name}: до`} type="range" min={0} max={points.length - 1} step={1} value={highIndex} disabled={blockInactive} onChange={(e) => setRange(attr.code, "max", Math.max(points[Number(e.target.value)], min))} className="range-thumb absolute inset-0 w-full" />
                      </div>
                    </div>
                  );
                })() : null}
                {attr.filter_mode === "numeric" ? null : (attr.values ?? []).map((v) => {
                  const selected = (filters.attributes[attr.code] ?? []).includes(v.value);
                  // Недоступное значение нельзя выбрать, но выбранное
                  // с нулевым результатом остаётся активным — чтобы его
                  // можно было снять.
                  const disabled = blockInactive || (!v.selected && v.available === false);
                  return (
                    <label
                      key={v.value}
                      className={cn(
                        "flex items-center gap-2.5",
                        disabled ? "cursor-not-allowed" : "cursor-pointer",
                      )}
                      aria-disabled={disabled || undefined}
                    >
                      <Checkbox
                        checked={selected}
                        disabled={disabled}
                        onCheckedChange={() => toggleAttr(attr.code, v.value)}
                      />
                      <span className={cn("flex-1 text-body-sm", disabled && "text-muted-foreground/60")}>
                        {v.label}
                      </span>
                      <span
                        className={cn(
                          "tabular-nums text-caption text-muted-foreground",
                          disabled && "text-muted-foreground/60",
                        )}
                      >
                        {v.count}
                      </span>
                    </label>
                  );
                })}
                {facetsLoading && facets.length === 0 && (
                  <p className="text-caption text-muted-foreground">Загрузка…</p>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
              );
            })}
          </Fragment>
        ))}
      </Accordion>
    </div>
  );
}
