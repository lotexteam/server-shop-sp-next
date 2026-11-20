import type { Category, Subcategory } from "@/data/types";

export type CategoryCrumb = { slug: string; title: string };

type TreeNode = Category | Subcategory;

/**
 * Цепочка категорий товара для хлебных крошек: корень → … → категория товара.
 *
 * Привязка берётся из `primaryCategorySlug` (pivot is_primary с бэкенда);
 * если API её не отдал — первый slug из `categorySlugs`. Сам `categorySlugs`
 * содержит и предков (их добавляет shipping_category_slugs для тарифов
 * доставки), поэтому цепочку строим обходом дерева, а не по плоскому списку:
 * иначе при нескольких привязках выбиралась первая по sort_order ветка,
 * а не основная категория.
 *
 * Категория не найдена в дереве (неактивна/скрыта фильтром API) — фолбэк:
 * самая глубокая ветка по любому slug, как было в карточке товара раньше.
 */
export function buildCategoryChain(
  categories: Category[],
  categorySlugs: string[] | undefined,
  primaryCategorySlug?: string | null,
): CategoryCrumb[] {
  if (!categories.length) return [];

  const slugs = categorySlugs ?? [];
  const anchor =
    primaryCategorySlug && slugs.includes(primaryCategorySlug)
      ? primaryCategorySlug
      : slugs[0];
  if (!anchor) return [];

  const children = (node: TreeNode): TreeNode[] | undefined =>
    node.children as TreeNode[] | undefined;

  // 1. Основная категория: путь от корня до первого узла с её slug.
  let chain: CategoryCrumb[] = [];
  const find = (nodes: TreeNode[], trail: CategoryCrumb[]): boolean => {
    for (const n of nodes) {
      const next = [...trail, { slug: n.slug, title: n.title }];
      if (n.slug === anchor) {
        chain = next;
        return true;
      }
      const kids = children(n);
      if (kids?.length && find(kids, next)) return true;
    }
    return false;
  };
  if (find(categories, [])) return chain;

  // 2. Фолбэк: основная скрыта — берём самую глубокую ветку по любому slug.
  let fallback: CategoryCrumb[] = [];
  const findAny = (nodes: TreeNode[], trail: CategoryCrumb[]): void => {
    for (const n of nodes) {
      const next = [...trail, { slug: n.slug, title: n.title }];
      if (slugs.includes(n.slug) && next.length > fallback.length) fallback = next;
      const kids = children(n);
      if (kids?.length) findAny(kids, next);
    }
  };
  findAny(categories, []);

  return fallback;
}