/**
 * Заголовки безопасности витрины — один источник для next.config.ts и
 * middleware.ts (второй нужен, потому что middleware отдаёт собственные
 * ответы: 404 для несуществующих сущностей и редиректы SeoDocument).
 *
 * Аудит 2026-11-20 (security): HSTS, X-Frame-Options, X-Content-Type-Options,
 * Content-Security-Policy, Cross-Origin-Opener-Policy, Referrer-Policy,
 * Permissions-Policy отсутствовали; X-Powered-By раскрывал стек.
 */

export type SecurityHeader = { key: string; value: string };

/**
 * CSP держим совместимой с текущим рантаймом:
 *  - 'unsafe-inline' — инлайн RSC-пейлоад Next и критический CSS в <head>;
 *  - 'unsafe-eval' — dev-сборка и MapLibre GL;
 *  - mc.yandex.ru / googletagmanager.com — согласованные счётчики (грузим
 *    только после согласия в lib/consent);
 *  - img-src https: — медиа отдаётся с отдельного S3-хоста;
 *  - frame-src https: — карта в контактах (iframe-фолбэк).
 */
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://mc.yandex.ru https://yandex.ru https://www.googletagmanager.com https://www.google-analytics.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  "media-src 'self' https: blob:",
  "frame-src 'self' https:",
  "worker-src 'self' blob:",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

export const SECURITY_HEADERS: SecurityHeader[] = [
  // 1 год; includeSubDomains безопасен: все хосты (*.store-server.ru) — HTTPS.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), payment=(), usb=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Content-Security-Policy", value: CSP },
];

/** Применить заголовки к произвольному Headers (NextResponse/Request). */
export function applySecurityHeaders(headers: Headers): Headers {
  for (const { key, value } of SECURITY_HEADERS) headers.set(key, value);
  return headers;
}
