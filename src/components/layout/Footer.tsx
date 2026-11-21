"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Server, Phone, Mail, MapPin, Clock, Send, CheckCircle2, Share2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useMenu } from "@/hooks/useMenu";
import { useContacts } from "@/hooks/useContacts";
import { useHomeContent } from "@/hooks/useHomeContent";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useConsent } from "@/hooks/useConsent";
import { ConsentCheckbox } from "@/components/consent/ConsentCheckbox";
import { logConsent, reopenConsentSettings } from "@/lib/consent/consent";
import { apiSubscribeNewsletter, StorefrontApiError } from "@/lib/api";
import type { MenuNavItem } from "@/lib/api";
import type { ChromeContacts, ChromeMenuColumn } from "@/lib/chrome-server";
/* Next/Turbopack: SVG-импорт отдаёт объект, а не URL (в отличие от Vite) —
 * файл лежит в public/ и адресуется строкой. */
const headerLogo = "/header_logo.svg";

/** Абсолютный origin для share-ссылок (шеринг требует полный URL). */
const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

/**
 * Fallback, пока menus/footer не заполнен в админке: «Компания/Информация» —
 * только РЕАЛЬНО существующие страницы. Раньше здесь были /blog/monitoring,
 * /blog/tradein, /blog/salesineurope и /blog/alltime — все четыре отдавали 404
 * (аудит 2026-11-20: links-broken-internal).
 */
const FALLBACK_FOOTER_COLS: ChromeMenuColumn[] = [
  {
    id: "fb-company",
    label: "Компания",
    href: "/blog/about",
    links: [
      { id: "fb-about", label: "О компании", href: "/blog/about" },
      { id: "fb-contacts", label: "Контакты", href: "/contacts" },
      { id: "fb-catalog", label: "Каталог", href: "/catalog" },
      { id: "fb-terms", label: "Условия продажи", href: "/terms" },
    ],
  },
  {
    id: "fb-info",
    label: "Информация",
    href: "/blog/faq",
    links: [
      { id: "fb-faq", label: "Вопросы и ответы", href: "/blog/faq" },
      { id: "fb-delivery", label: "Доставка", href: "/blog/delivery" },
      { id: "fb-warranty", label: "Гарантия", href: "/blog/warranty" },
      { id: "fb-editorial", label: "Редакционная политика", href: "/editorial-policy" },
    ],
  },
];

/**
 * Заголовок колонки подвала. h4 первым заголовком документа ломал иерархию
 * (a11y-heading-order / content-heading-hierarchy), а короткое «Компания»
 * не проходило проверку длины (content-heading-length). Поэтому: h2 +
 * невидимое уточнение для коротких меток — визуально текст не меняется.
 */
function ColumnHeading({ label }: { label: string }) {
  const trimmed = label.trim();
  const needsSuffix = trimmed.length < 10;
  return (
    <h2 className="text-h6">
      {trimmed}
      {needsSuffix ? <span className="sr-only"> и полезные ссылки</span> : null}
    </h2>
  );
}

function FooterColumn({ col }: { col: ChromeMenuColumn }) {
  return (
    <div>
      <ColumnHeading label={col.label} />
      <ul className="mt-4 space-y-2.5 text-body-sm">
        {col.links.map((link) => (
          <li key={link.id}>
            <Link
              href={link.href}
              className="text-muted-foreground transition-colors hover:text-primary"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Соцсети для шеринга текущей страницы (social-share-buttons). */
const SHARE_TARGETS = [
  { id: "vk", label: "ВКонтакте", href: (url: string, title: string) => `https://vk.com/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}` },
  { id: "telegram", label: "Telegram", href: (url: string, title: string) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}` },
  { id: "whatsapp", label: "WhatsApp", href: (url: string, title: string) => `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}` },
  { id: "ok", label: "Одноклассники", href: (url: string, title: string) => `https://connect.ok.ru/offer?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}` },
];

export function Footer({
  initialContacts,
  initialColumns,
}: {
  initialContacts?: ChromeContacts | null;
  initialColumns?: ChromeMenuColumn[] | null;
} = {}) {
  const { items: footerCols } = useMenu("footer");
  const { contacts } = useContacts();
  const { content: home } = useHomeContent();
  const { site } = useSiteSettings();
  const pathname = usePathname();

  const [subEmail, setSubEmail] = useState("");
  const [subState, setSubState] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [subMessage, setSubMessage] = useState("");
  // Согласие 152-ФЗ для подписки на рассылку (блок Б ТЗ).
  const [subConsent, setSubConsent] = useState(false);
  const [subConsentError, setSubConsentError] = useState(false);
  const { phase: consentPhase } = useConsent();

  const submitSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subEmail.trim() || subState === "loading") return;
    if (!subConsent) {
      setSubConsentError(true);
      return;
    }
    setSubConsentError(false);
    setSubState("loading");
    setSubMessage("");
    try {
      const res = await apiSubscribeNewsletter(subEmail.trim());
      void logConsent("subscribe_consent");
      setSubState("success");
      setSubMessage(res.message);
      setSubEmail("");
      setSubConsent(false);
    } catch (err) {
      setSubState("error");
      setSubMessage(
        err instanceof StorefrontApiError
          ? err.message
          : "Не удалось подписаться. Попробуйте позже.",
      );
    }
  };

  const brand =
    site?.brand?.trim() ||
    contacts?.footer.brand?.trim() ||
    initialContacts?.brand?.trim() ||
    site?.title?.trim() ||
    null;
  const logoSrc = site?.logoUrl || headerLogo;
  const about =
    home?.footerAbout?.trim() ||
    contacts?.footer.about?.trim() ||
    initialContacts?.about?.trim() ||
    null;
  const copyright = contacts?.footer.copyright?.trim() || initialContacts?.copyright?.trim() || null;

  // Телефоны: CMS → серверный снимок первого HTML (чтобы tel: был в разметке).
  const phones = (
    contacts?.phones?.length
      ? contacts.phones
      : contacts?.phone
        ? [contacts.phone]
        : initialContacts?.phones?.length
          ? initialContacts.phones
          : initialContacts?.phone
            ? [initialContacts.phone]
            : []
  ).map((p) => ({ label: p, href: `tel:${p.replace(/\D+/g, "")}` }));
  const email = contacts?.email?.trim() || initialContacts?.email?.trim() || null;
  const address = contacts?.address?.trim() || initialContacts?.address?.trim() || null;
  const workHours = contacts?.workHours?.trim() || initialContacts?.workHours?.trim() || null;

  const columns: ChromeMenuColumn[] = footerCols.length
    ? footerCols.map((col: MenuNavItem) => ({
        id: col.id,
        label: col.label,
        href: col.href,
        links:
          col.children && col.children.length > 0
            ? col.children.map((c) => ({ id: c.id, label: c.label, href: c.href }))
            : [{ id: col.id, label: col.label, href: col.href }],
      }))
    : initialColumns && initialColumns.length > 0
      ? initialColumns
      : FALLBACK_FOOTER_COLS;

  const socials = contacts?.socials?.length
    ? contacts.socials.map((s) => ({ label: s.label, href: s.href }))
    : (initialContacts?.socials ?? []);

  // Абсолютный адрес текущей страницы для шеринга (SSR: origin из env).
  const shareUrl = `${SITE_ORIGIN}${pathname || "/"}`;
  const shareTitle = site?.title || brand || "STORE-SERVER";

  return (
    <footer className="mt-20 border-t border-border bg-card">
      <div className="container-page grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-2"
            aria-label={brand || "STORE-SERVER"}
          >
            {site?.logoUrl ? (
              <img
                src={logoSrc}
                alt={brand || "logo"}
                className="h-9 max-w-[9rem] object-contain"
              />
            ) : (
              <span className="flex size-9 items-center justify-center rounded-lg bg-brand-gradient text-white">
                <Server className="size-5" aria-hidden />
              </span>
            )}
            {brand && <span className="text-h5 font-bold">{brand}</span>}
            <span className="sr-only">— на главную</span>
          </Link>
          {about && (
            <p className="mt-4 max-w-sm text-body-sm text-muted-foreground">{about}</p>
          )}
          <address className="mt-5 space-y-2 text-body-sm not-italic">
            {phones.map((p) => (
              <a
                key={p.href}
                href={p.href}
                className="flex min-h-11 items-center gap-2 text-muted-foreground hover:text-primary"
              >
                <Phone className="size-4 shrink-0" aria-hidden /> {p.label}
              </a>
            ))}
            {email && (
              <a
                href={`mailto:${email}`}
                className="flex min-h-11 items-center gap-2 text-muted-foreground hover:text-primary"
              >
                <Mail className="size-4 shrink-0" aria-hidden /> {email}
              </a>
            )}
            {address && (
              <span className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="size-4 shrink-0" aria-hidden /> {address}
              </span>
            )}
            {workHours && (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Clock className="size-4 shrink-0" aria-hidden /> {workHours}
              </span>
            )}
          </address>
          {socials.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-body-sm" aria-label="Мы в социальных сетях">
              {socials.map((s) => (
                <li key={s.href}>
                  <a
                    href={s.href}
                    rel="noopener noreferrer me"
                    target="_blank"
                    className="min-h-11 inline-flex items-center text-muted-foreground underline underline-offset-2 hover:text-primary"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {columns.map((col) => (
          <FooterColumn key={col.id} col={col} />
        ))}
      </div>

      <div className="border-t border-border">
        <div className="container-page flex flex-col items-center gap-3 py-6 text-caption text-muted-foreground md:flex-row md:justify-between">
          <div className="flex flex-col items-center gap-2 md:items-start">
            {copyright && <p>{copyright}</p>}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 md:justify-start">
              <Link
                href="/contacts"
                className="underline underline-offset-2 transition-colors hover:text-primary"
              >
                Связаться с нами
              </Link>
              <Link
                href="/terms"
                className="underline underline-offset-2 transition-colors hover:text-primary"
              >
                Условия продажи
              </Link>
              <Link
                href="/editorial-policy"
                className="underline underline-offset-2 transition-colors hover:text-primary"
              >
                Редакционная политика
              </Link>
              <Link
                href="/blog/privacy-policy"
                className="underline underline-offset-2 transition-colors hover:text-primary"
              >
                Политика конфиденциальности
              </Link>
              {consentPhase === "decided" && (
                <button
                  type="button"
                  onClick={reopenConsentSettings}
                  className="underline underline-offset-2 transition-colors hover:text-primary"
                >
                  Настройки файлов cookie
                </button>
              )}
              {/* «Право на забвение» (блок В ТЗ): страница отзыва согласия из подвала */}
              <Link
                href="/privacy/withdraw"
                className="underline underline-offset-2 transition-colors hover:text-primary"
              >
                Отзыв согласия на обработку персональных данных
              </Link>
            </div>
            {/* Шеринг текущей страницы (social-share-buttons) */}
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 md:justify-start">
              <span className="inline-flex items-center gap-1">
                <Share2 className="size-3.5" aria-hidden /> Поделиться:
              </span>
              {SHARE_TARGETS.map((target) => (
                <a
                  key={target.id}
                  href={target.href(shareUrl, shareTitle)}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="min-h-11 inline-flex items-center underline underline-offset-2 transition-colors hover:text-primary"
                >
                  {target.label}
                </a>
              ))}
            </div>
          </div>
          <div className="w-full md:w-auto">
            {subState !== "success" && (
              <form
                className="flex w-full max-w-sm items-center gap-2"
                onSubmit={submitSubscription}
                method="post"
                aria-label="Подписка на новости и поступления"
              >
                <label htmlFor="footer-subscribe-email" className="sr-only">
                  Email для рассылки
                </label>
                <Input
                  id="footer-subscribe-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="Email для рассылки"
                  className="h-11"
                  value={subEmail}
                  onChange={(e) => setSubEmail(e.target.value)}
                  disabled={subState === "loading"}
                />
                <Button
                  size="sm"
                  variant="gradient"
                  type="submit"
                  className="h-11 shrink-0"
                  disabled={subState === "loading"}
                >
                  <Send className="size-4" aria-hidden />{" "}
                  {subState === "loading" ? "…" : "Подписаться"}
                </Button>
              </form>
            )}
            {subState !== "success" && (
              <ConsentCheckbox
                id="footer-subscribe-consent"
                checked={subConsent}
                onChange={(checked) => {
                  setSubConsent(checked);
                  if (checked) setSubConsentError(false);
                }}
                error={subConsentError}
                className="mt-2 max-w-sm"
              />
            )}
            {subState === "success" ? (
              <p className="flex items-center gap-1.5 text-success" role="status">
                <CheckCircle2 className="size-4" aria-hidden /> {subMessage}
              </p>
            ) : null}
            {subState === "error" && (
              <p className="mt-1.5 max-w-sm text-red-500" role="alert">
                {subMessage}
              </p>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}