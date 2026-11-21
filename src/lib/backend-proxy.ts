/**
 * Прокси машиночитаемых файлов витрины на Storefront API.
 *
 * Контент (/AGENTS.md, /index.md, /.well-known/mcp.json, agent-card.json,
 * llms.txt) генерирует бэкенд из CMS — витрина только отдаёт его по
 * публичному адресу с нужным Content-Type. Так один источник правды:
 * правки в админке сразу видны и человеку, и агенту.
 */

import { API_BASE_SERVER } from "./api-base";

type ProxyOptions = {
  /** Ожидаемый Content-Type ответа (витрина не отдаёт HTML вместо файла). */
  contentType: string;
  /** Время кэширования на CDN/браузере, сек. */
  maxAge?: number;
};

/**
 * Origin витрины для X-Seo-Site: бэкенд подставляет его в абсолютные ссылки
 * внутри AGENTS.md/index.md/mcp.json. Без заголовка он возьмёт
 * `shop.storefront_url` — на мультиинстансе это может быть чужой скин.
 */
function storefrontOrigin(): string | null {
  const raw = (process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

export async function proxyBackendFile(
  path: string,
  { contentType, maxAge = 3600 }: ProxyOptions,
): Promise<Response> {
  try {
    const origin = storefrontOrigin();
    const response = await fetch(`${API_BASE_SERVER}${path}`, {
      headers: {
        Accept: contentType.split(";")[0],
        ...(origin ? { "X-Seo-Site": origin } : {}),
      },
      next: { revalidate: maxAge },
      signal: AbortSignal.timeout(4000),
    });

    if (!response.ok) {
      // 404 от API — файл выключен в админке, а не сбой витрины.
      return new Response(response.status === 404 ? "Not found" : "Service unavailable", {
        status: response.status === 404 ? 404 : 503,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }

    const body = await response.text();
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": `public, max-age=${maxAge}, s-maxage=${maxAge}`,
      },
    });
  } catch (error) {
    console.error(`[backend-proxy] ${path}:`, error);
    return new Response("Service unavailable", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
}
