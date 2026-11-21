/**
 * Серверные данные «обвязки» (шапка/подвал) для первого HTML.
 *
 * Зачем: телефон, email и адрес в подвале раньше появлялись только после
 * клиентского fetch /settings/contacts. В SSR-разметке их не было — поисковик
 * и аудит 2026-11-20 не находили ни контактной страницы с контактами, ни
 * физического адреса (eeat-contact-page, eeat-physical-address), а цена
 * E-E-A-T падала. Здесь тот же контракт, что в fetchContacts (lib/api.ts),
 * но только нужные подвалу поля и без браузерных зависимостей.
 */

import { API_BASE_SERVER } from "@/lib/api-base";

const FETCH_TIMEOUT_MS = 4000;
const CHROME_REVALIDATE_S = 300;

export type ChromeContacts = {
  phone: string | null;
  email: string | null;
  address: string | null;
  workHours: string | null;
  phones: string[];
  brand: string | null;
  about: string | null;
  copyright: string | null;
  /** Соцпрофили из CMS (Настройки → Контакты → Соцсети). */
  socials: Array<{ label: string; href: string }>;
};

export type ChromeMenuLink = { id: string; label: string; href: string };
export type ChromeMenuColumn = { id: string; label: string; href: string; links: ChromeMenuLink[] };

export const EMPTY_CHROME_CONTACTS: ChromeContacts = {
  phone: null,
  email: null,
  address: null,
  workHours: null,
  phones: [],
  brand: null,
  about: null,
  copyright: null,
  socials: [],
};

type ApiItem<T> = { data?: T | null };

function appUrlOrigin(): string {
  const raw = (process.env.APP_URL || "").replace(/\/$/, "");
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
}

async function serverGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE_SERVER}${path}`, {
      headers: {
        Accept: "application/json",
        ...(appUrlOrigin() ? { "X-Seo-Site": appUrlOrigin() } : {}),
      },
      next: { revalidate: CHROME_REVALIDATE_S },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type ApiContacts = {
  phones?: string[] | null;
  phone?: string | null;
  email?: string | null;
  emails?: string[] | null;
  address?: string | null;
  work_hours?: string | null;
  socials?: Array<{ label?: string | null; name?: string | null; url?: string | null; href?: string | null }> | null;
  footer?: { brand?: string | null; about?: string | null; copyright?: string | null } | null;
};

/** GET /settings/contacts → поля подвала/шапки (SSR первого кадра). */
export async function fetchChromeContactsServer(): Promise<ChromeContacts> {
  const res = await serverGet<ApiItem<ApiContacts>>("/settings/contacts");
  const raw = res?.data;
  if (!raw) return EMPTY_CHROME_CONTACTS;

  const phones = (raw.phones?.length ? raw.phones : raw.phone ? [raw.phone] : [])
    .map((p) => String(p || "").trim())
    .filter(Boolean);
  const emails = (raw.emails?.length ? raw.emails : raw.email ? [raw.email] : [])
    .map((e) => String(e || "").trim())
    .filter(Boolean);
  const socials = (raw.socials ?? [])
    .map((s) => {
      const href = String(s.url || s.href || "").trim();
      if (!href) return null;
      return {
        label: String(s.label || s.name || "").trim() || href,
        href,
      };
    })
    .filter((s): s is { label: string; href: string } => s !== null);

  return {
    phone: phones[0] ?? null,
    email: emails[0] ?? null,
    address: String(raw.address || "").trim() || null,
    workHours: String(raw.work_hours || "").trim() || null,
    phones,
    brand: String(raw.footer?.brand || "").trim() || null,
    about: String(raw.footer?.about || "").trim() || null,
    copyright: String(raw.footer?.copyright || "").trim() || null,
    socials,
  };
}

type ApiMenu = {
  items?: Array<{
    id?: string;
    title?: string;
    type?: string;
    url?: string | null;
    href?: string | null;
    category?: { slug?: string; name?: string } | null;
    children?: Array<{
      id?: string;
      title?: string;
      type?: string;
      url?: string | null;
      href?: string | null;
      category?: { slug?: string; name?: string } | null;
    }> | null;
  }> | null;
};

function menuHref(item: { type?: string; url?: string | null; href?: string | null; category?: { slug?: string } | null }): string {
  const slug = item.category?.slug || "";
  const raw = item.type === "category" && slug
    ? `/catalog/${encodeURIComponent(slug)}`
    : (item.href || item.url || "/");
  return raw.startsWith("/") || raw.startsWith("http") ? raw : `/${raw}`;
}

/** GET /menus/{code} → колонки подвала с дочерними ссылками (для SSR). */
export async function fetchMenuColumnsServer(code: string): Promise<ChromeMenuColumn[]> {
  const res = await serverGet<ApiItem<ApiMenu>>(`/menus/${encodeURIComponent(code)}`);
  const items = res?.data?.items;
  if (!Array.isArray(items)) return [];
  return items
    .map((item, n) => ({
      id: String(item.id || `menu-${n}`),
      label: String(item.title || item.category?.name || "").trim(),
      href: menuHref(item),
      links: (item.children ?? [])
        .map((child, i) => ({
          id: String(child.id || `menu-${n}-${i}`),
          label: String(child.title || child.category?.name || "").trim(),
          href: menuHref(child),
        }))
        .filter((child) => child.label),
    }))
    .filter((column) => column.label && column.links.length > 0);
}
