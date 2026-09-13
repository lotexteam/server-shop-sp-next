export type ConditionGrade = "new" | "used";

/** Product lifecycle values returned by the storefront API. */
export type ProductStatus = "draft" | "published" | "hidden" | "archived";

/** Configurator/platform lifecycle values returned by the storefront API. */
export type ConfiguratorStatus = "disabled" | "available";

export interface Product {
  id: string;
  slug: string;
  title: string;
  /** Empty when the product has no brand in admin. */
  brand: string;
  /** Primary category slug (may be empty when the product has no categories). */
  category: string;
  /** Primary category title from API (never a type/slug code). */
  categoryTitle?: string;
  /** All attached category slugs for filters / parent+child matching. */
  categorySlugs?: string[];
  image: string;
  /** Gallery URLs from admin media (empty → use image placeholder) */
  images?: string[];
  price: number | null;
  oldPrice?: number | null;
  /** «Под заказ»: price hidden, product excluded from totals */
  onRequest?: boolean;
  status: ProductStatus | null;
  configuratorStatus?: ConfiguratorStatus | null;
  condition: ConditionGrade;
  rating?: number;
  reviews?: number;
  badges?: string[];
  specs: { label: string; value: string }[];
  description?: string;
  documents?: Array<{ name: string; url: string }>;
  /** Backend flag: product has configurator slots → special product page view */
  isConfigurable?: boolean;
  /** Ready-made build; «Изменить» opens the parent configurator. */
  isReadyConfiguration?: boolean;
  configuratorEdit?: {
    productId: string;
    slug: string;
    name?: string;
    selections: Array<{ slot_id: string; product_id: string; qty: number }>;
  } | null;
  /** Ready-kit BOM for the product page (slot → name × qty). */
  composition?: Array<{ slot: string; name: string; qty: number }>;
  sku?: string;
  /** attribute code → selected filter keys (storefront catalog) */
  filterValues?: Record<string, string[]>;
  shortName?: string;
  shortDescription?: string;
  /** Ready-made warranty package only; null → hide on card */
  warranty?: {
    packageId: string;
    name: string;
    months: number | null;
    label: string;
  } | null;
}

/** Cart build payload for POST /checkout|cart (parent + slot selections). */
export type ConfiguratorBuild = {
  selections: Array<{ slot_id: string; product_id: string; qty: number }>;
};

/** Saved configurator build (local until account API exists). */
export type SavedConfig = {
  id: string;
  name: string;
  productId: string;
  productSlug: string;
  productTitle: string;
  productImage: string;
  brand: string;
  total: number;
  build: ConfiguratorBuild;
  /** Human-readable lines for account list */
  lines: Array<{ label: string; value: string; price: number }>;
  createdAt: string;
};

export interface Subcategory {
  id: string;
  slug: string;
  title: string;
  count: number;
  children?: Subcategory[];
}

export interface Category {
  id: string;
  slug: string;
  title: string;
  icon: string;
  count: number;
  description?: string;
  parentId?: string | null;
  children?: Subcategory[];
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  /** Обложка опциональна: null — карточка/шапка без изображения */
  cover: string | null;
  category: string;
  /** slug/code рубрики (для фильтра /blog?category= из CMS-меню) */
  categorySlug?: string;
  author: string;
  /** Авторский блок скрыт (настраивается в админке) */
  hideAuthor?: boolean;
  date: string;
  readingTime: number;
}

export interface Review {
  id: string;
  author: string;
  rating: number;
  date: string;
  text: string;
  verified: boolean;
}
