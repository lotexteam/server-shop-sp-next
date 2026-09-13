/**
 * Модуль согласий 152-ФЗ (cookie-баннер + категории скриптов).
 *
 * Единственная точка решения о запуске трекеров: конфиг берется из
 * GET /api/v1/consent/config, а выбор пользователя живёт в localStorage
 * долго (по ТЗ — consent_ttl_days, по умолчанию 365 дней): баннер
 * принимается один раз и повторяется по истечении срока или после очистки
 * данных браузера. Пока нет действующего выбора, скрипты аналитики/
 * маркетинга не запускаются: initMetrica() вызывается только после
 * согласия на категорию «analytics». Яндекс.Метрика остаётся в
 * lib/analytics/metrica.ts — этот модуль только управляет её запуском.
 */

import { initMetrica } from "@/lib/analytics/metrica";

import { API_BASE } from "@/lib/api-base";

const STORAGE_KEY = "server-price-consent-v1";
const VISITOR_KEY = "server-price-visitor-v1";
const DEFAULT_TTL_DAYS = 365;

export const DEFAULT_FORM_CONSENT_TEXT =
  "Отправляя форму, я даю согласие на обработку моих персональных данных в соответствии с Политикой конфиденциальности.";
export const DEFAULT_PRIVACY_HREF = "/blog/privacy-policy";
export const DEFAULT_COOKIES_HREF = "/blog/cookie-policy";

export type ConsentChoice = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
};

export type ConsentConfig = {
  enabled: boolean;
  banner?: {
    text: string;
    accept_label: string;
    customize_label: string;
    bg: string;
    text_color: string;
    accent_color: string;
    custom_css: string;
  };
  settings?: {
    title: string;
    description: string;
    save_label: string;
    categories: Record<
      "necessary" | "analytics" | "marketing",
      { label: string; description: string; locked: boolean }
    >;
  };
  links?: { privacy: string; cookies: string };
  policy_version?: string;
  /** Срок действия согласия в днях (ТЗ: 365); баннер повторится после него. */
  consent_ttl_days?: number;
  /** Срок хранения пользовательской конфигурации сайта (сборки) в минутах. */
  storage_ttl_minutes?: number;
  defaults?: { analytics: boolean; marketing: boolean };
  snippets?: { analytics: string[]; marketing: string[] };
  form_consent_text?: string;
};

export type ConsentPhase = "loading" | "disabled" | "pending" | "decided";

export type ConsentState = {
  phase: ConsentPhase;
  config: ConsentConfig | null;
  choice: ConsentChoice | null;
};

type StoredConsent = {
  choice: ConsentChoice;
  policy_version: string;
  decided_at: string;
  expires_at: number;
};

/* ── State store (useSyncExternalStore-friendly) ─────────────────── */

let state: ConsentState = { phase: "loading", config: null, choice: null };
const listeners = new Set<() => void>();

function setState(patch: Partial<ConsentState>): void {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

export function getConsentState(): ConsentState {
  return state;
}

/** TTL хранения сборки конфигуратора в миллисекундах (сервер, по умолчанию 60 минут). */
export function configuratorTtlMs(): number {
  const minutes = Number(state.config?.storage_ttl_minutes ?? 60);
  if (!Number.isFinite(minutes) || minutes <= 0) return 60 * 60 * 1000;
  return Math.min(525600, Math.max(1, Math.floor(minutes))) * 60 * 1000;
}

export function subscribeConsent(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/* ── Storage (localStorage, срок согласия — consent_ttl_days) ────── */

function ttlDays(config: ConsentConfig | null): number {
  return Math.max(1, config?.consent_ttl_days ?? DEFAULT_TTL_DAYS);
}

function readStored(config: ConsentConfig | null): StoredConsent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConsent;
    if (!parsed?.choice || typeof parsed.expires_at !== "number") return null;
    if (parsed.expires_at <= Date.now()) {
      // Согласие истекло — баннер показывается повторно.
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(choice: ConsentChoice, config: ConsentConfig | null): void {
  const ttlMs = ttlDays(config) * 24 * 60 * 60 * 1000;
  const record: StoredConsent = {
    choice,
    policy_version: config?.policy_version ?? "",
    decided_at: new Date().toISOString(),
    expires_at: Date.now() + ttlMs,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* приватный режим / переполнение — согласие просто не переживёт перезагрузку */
  }
}

/** Анонимный id посетителя для журнала согласий (хранится на сервере только как HMAC-хэш). */
function visitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const fresh =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `v-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(VISITOR_KEY, fresh);
    return fresh;
  } catch {
    return "anon";
  }
}

/* ── Public helpers for forms/banner ─────────────────────────────── */

export function formConsentText(): string {
  return state.config?.form_consent_text || DEFAULT_FORM_CONSENT_TEXT;
}

export function privacyPolicyHref(): string {
  return state.config?.links?.privacy || DEFAULT_PRIVACY_HREF;
}

export function cookiesPolicyHref(): string {
  return state.config?.links?.cookies || DEFAULT_COOKIES_HREF;
}

/* ── Snippet injection (VK pixel etc.; Метрика — через initMetrica) ─ */

function injectSnippet(code: string): void {
  const trimmed = code.trim();
  if (!trimmed) return;
  if (trimmed.startsWith("<script")) {
    const tpl = document.createElement("template");
    tpl.innerHTML = trimmed;
    tpl.content.querySelectorAll("script").forEach((old) => {
      const script = document.createElement("script");
      Array.from(old.attributes).forEach((attr) => script.setAttribute(attr.name, attr.value));
      script.text = old.text;
      document.head.appendChild(script);
    });
    return;
  }
  // Raw JS (как в админских head_snippets).
  try {
    void new Function(trimmed)();
  } catch {
    /* ошибка сниппета не должна ломать витрину */
  }
}

function applyChoice(choice: ConsentChoice): void {
  const snippets = state.config?.snippets;
  if (snippets?.analytics?.length && choice.analytics) {
    snippets.analytics.forEach(injectSnippet);
  }
  if (snippets?.marketing?.length && choice.marketing) {
    snippets.marketing.forEach(injectSnippet);
  }
  // Счетчик Яндекс.Метрики = категория «аналитические» (его домен — metrica.ts).
  if (choice.analytics) void initMetrica();
}

/* ── Log ─────────────────────────────────────────────────────────── */

export async function logConsent(
  action: string,
  extra?: { policy_version?: string },
): Promise<void> {
  try {
    await fetch(`${API_BASE}/consent/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      keepalive: true,
      body: JSON.stringify({
        action,
        page_url: window.location.href,
        policy_version: extra?.policy_version ?? state.config?.policy_version ?? undefined,
        visitor_id: visitorId(),
      }),
    });
  } catch {
    /* логирование не должно влиять на UX */
  }
}

/* ── Init & decisions ────────────────────────────────────────────── */

async function fetchConfig(): Promise<ConsentConfig> {
  try {
    const res = await fetch(`${API_BASE}/consent/config`, {
      headers: { Accept: "application/json" },
    });
    return res.ok
      ? ((await res.json()) as { data: ConsentConfig })?.data ?? { enabled: false }
      : { enabled: false };
  } catch {
    // Нет API (dev-mock / недоступен бэкенд) — ведём себя как раньше, без баннера.
    return { enabled: false };
  }
}

/**
 * Точка входа вместо прямого initMetrica(): решает, нужен ли баннер,
 * и запускает аналитику только при действующем согласии.
 * Вызывается один раз из main.tsx до монтирования React.
 */
export async function initConsent(): Promise<void> {
  const config = await fetchConfig();
  if (!config.enabled) {
    setState({ phase: "disabled", config });
    void initMetrica();
    return;
  }

  const stored = readStored(config);
  if (stored) {
    const choice = stored.choice;
    setState({ phase: "decided", config, choice });
    applyChoice(choice);
    return;
  }

  // Нет действующего согласия: баннер покажется, трекеры заблокированы.
  setState({ phase: "pending", config });
}

/** «Принять все» или «Сохранить настройки» из панели (согласие — один раз). */
export function decideConsent(
  partial: { analytics: boolean; marketing: boolean },
  action: "cookie_accepted" | "cookie_custom" = "cookie_accepted",
): void {
  if (!state.config?.enabled) return;
  const choice: ConsentChoice = { necessary: true, ...partial };
  writeStored(choice, state.config);
  setState({ phase: "decided", choice });
  applyChoice(choice);
  void logConsent(action);
}

/** Повторный показ панели («Настройки cookie» из подвала). */
export function reopenConsentSettings(): void {
  if (!state.config?.enabled) return;
  setState({ phase: "pending", choice: state.choice });
}
