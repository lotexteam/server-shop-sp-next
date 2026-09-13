"use client";

/**
 * Клиентская часть SEO-слоя Next-версии.
 *
 * В SPA этот модуль отвечал за всё: fetch /seo/document, метатеги, canonical,
 * OG, JSON-LD — всё применялось в рантайме через DOM. В Next.js полные
 * метаданные генерирует сервер (generateMetadata + lib/seo-server.ts), и
 * они уже есть в SSR-HTML каждого URL.
 *
 * Здесь остаются только клиентские обязанности:
 *  - usePageMeta: мягкий override document.title для страниц, чей тайтл
 *    становится известен после клиентского fetch (совместимость со старым
 *    API; серверные метаданные — источник истины);
 *  - ClientHead: отправка hit'ов Яндекс.Метрики при SPA-переходах
 *    (trackHit из lib/analytics/metrica.ts, как было в DocumentHeadInner).
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackHit } from "@/lib/analytics/metrica";
import { formatPageTitle, getCachedSite } from "@/lib/api";

export function usePageMeta(title?: string | null, description?: string | null) {
  // description применяется только сервером; клиентский override не нужен.
  void description;
  useEffect(() => {
    if (!title) return;
    // Тот же формат, что в applyFallback SPA-версии (суффикс сайта),
    // чтобы не терять «— Бренд» в тайтле.
    document.title = formatPageTitle(title, getCachedSite());
  }, [title]);
}

/** Отправляет hit при каждом клиентском переходе (включая search-часть URL). */
export function ClientHead() {
  const pathname = usePathname();
  useEffect(() => {
    trackHit();
  }, [pathname]);
  return null;
}
