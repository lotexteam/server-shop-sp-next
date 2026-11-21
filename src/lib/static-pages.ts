/**
 * Статические информационные страницы из Storefront API (CMS).
 *
 * Текст условий продажи и редакционной политики живёт в бэкенде
 * (App\Domains\Cms\Application\StaticPages → cms.pages), витрина его только
 * рендерит. Это закрывает eeat-terms-of-service / eeat-editorial-policy и
 * не дублирует контент в коде фронтенда.
 */

import { API_BASE_SERVER } from "@/lib/api-base";

const FETCH_TIMEOUT_MS = 4000;
const REVALIDATE_S = 600;

export type StaticPageSection = {
  title: string;
  paragraphs: string[];
  list?: string[];
};

export type StaticPage = {
  slug: string;
  title: string;
  lead: string;
  /** W3C-дата обновления (Y-m-d). */
  updated: string;
  sections: StaticPageSection[];
};

export async function fetchStaticPageServer(slug: string): Promise<StaticPage | null> {
  try {
    const res = await fetch(`${API_BASE_SERVER}/pages/${encodeURIComponent(slug)}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: REVALIDATE_S },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const payload = (await res.json()) as { data?: StaticPage };
    return payload.data ?? null;
  } catch {
    return null;
  }
}
