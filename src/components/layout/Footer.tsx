"use client";

import { useState } from "react";
import Link from "next/link";
import { Server, Phone, Mail, MapPin, Send, CheckCircle2 } from "lucide-react";
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
import headerLogo from "@/assets/header_logo.svg";

/** Fallback, пока menus/footer не заполнен в админке: «Компания/Информация» — посты блога (рубрика info). */
const FALLBACK_FOOTER_COLS: MenuNavItem[] = [
  {
    id: "fb-company",
    label: "Компания",
    href: "/blog/about",
    children: [
      { id: "fb-about", label: "О компании", href: "/blog/about" },
      { id: "fb-contacts", label: "Контакты", href: "/blog/contacts" },
      { id: "fb-services", label: "Услуги", href: "/blog/services" },
      { id: "fb-monitoring", label: "Мониторинг", href: "/blog/monitoring" },
    ],
  },
  {
    id: "fb-info",
    label: "Информация",
    href: "/blog/faq",
    children: [
      { id: "fb-faq", label: "Вопросы и ответы", href: "/blog/faq" },
      { id: "fb-delivery", label: "Доставка", href: "/blog/delivery" },
      { id: "fb-warranty", label: "Гарантия", href: "/blog/warranty" },
      { id: "fb-tradein", label: "Trade-in", href: "/blog/tradein" },
      { id: "fb-salesineurope", label: "Продажи в Европе", href: "/blog/salesineurope" },
      { id: "fb-alltime", label: "Работаем без выходных", href: "/blog/alltime" },
    ],
  },
];

function FooterColumn({ col }: { col: MenuNavItem }) {
  const links =
    col.children && col.children.length > 0
      ? col.children
      : [{ id: col.id, label: col.label, href: col.href }];

  return (
    <div>
      <h4 className="text-h6">{col.label}</h4>
      <ul className="mt-4 space-y-2.5 text-body-sm">
        {links.map((link) => (
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

export function Footer() {
  const { items: footerCols } = useMenu("footer");
  const { contacts } = useContacts();
  const { content: home } = useHomeContent();
  const { site } = useSiteSettings();

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
    site?.title?.trim() ||
    null;
  const logoSrc = site?.logoUrl || headerLogo;
  const about = home?.footerAbout?.trim() || contacts?.footer.about?.trim() || null;
  const copyright = contacts?.footer.copyright?.trim() || null;

  const phone = contacts?.phone?.trim() || null;
  // Все номера из CMS (Настройки → Контакты), первый — основной
  const phones = (contacts?.phones?.length
    ? contacts.phones
    : phone
      ? [phone]
      : []
  ).map((p) => ({ label: p, href: `tel:${p.replace(/\D+/g, "")}` }));
  const email = contacts?.email?.trim() || null;
  const address = contacts?.address?.trim() || null;

  return (
    <footer className="mt-20 border-t border-border bg-card">
      <div className="container-page grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Link href="/" className="flex items-center gap-2">
            {site?.logoUrl ? (
              <img
                src={logoSrc}
                alt={brand || "logo"}
                className="h-9 max-w-[9rem] object-contain"
              />
            ) : (
              <span className="flex size-9 items-center justify-center rounded-lg bg-brand-gradient text-white">
                <Server className="size-5" />
              </span>
            )}
            {brand && <span className="text-h5 font-bold">{brand}</span>}
          </Link>
          {about && (
            <p className="mt-4 max-w-sm text-body-sm text-muted-foreground">{about}</p>
          )}
          <div className="mt-5 space-y-2 text-body-sm">
            {phones.map((p) => (
              <a
                key={p.href}
                href={p.href}
                className="flex items-center gap-2 text-muted-foreground hover:text-primary"
              >
                <Phone className="size-4 shrink-0" /> {p.label}
              </a>
            ))}
            {email && (
              <a
                href={`mailto:${email}`}
                className="flex items-center gap-2 text-muted-foreground hover:text-primary"
              >
                <Mail className="size-4 shrink-0" /> {email}
              </a>
            )}
            {address && (
              <span className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="size-4 shrink-0" /> {address}
              </span>
            )}
          </div>
        </div>

        {(footerCols.length > 0 ? footerCols : FALLBACK_FOOTER_COLS).map((col) => (
          <FooterColumn key={col.id} col={col} />
        ))}
      </div>

      <div className="border-t border-border">
        <div className="container-page flex flex-col items-center gap-3 py-6 text-caption text-muted-foreground md:flex-row md:justify-between">
          <div className="flex flex-col items-center gap-2 md:items-start">
            {copyright && <p>{copyright}</p>}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 md:justify-start">
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
          </div>
          <div className="w-full md:w-auto">
            {subState !== "success" && (
              <form
                className="flex w-full max-w-sm items-center gap-2"
                onSubmit={submitSubscription}
              >
                <Input
                  type="email"
                  required
                  placeholder="Email для рассылки"
                  className="h-10"
                  value={subEmail}
                  onChange={(e) => setSubEmail(e.target.value)}
                  disabled={subState === "loading"}
                />
                <Button
                  size="sm"
                  variant="gradient"
                  type="submit"
                  className="shrink-0"
                  disabled={subState === "loading"}
                >
                  <Send className="size-4" />{" "}
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
              <p className="flex items-center gap-1.5 text-success">
                <CheckCircle2 className="size-4" /> {subMessage}
              </p>
            ) : null}
            {subState === "error" && (
              <p className="mt-1.5 max-w-sm text-red-500">{subMessage}</p>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
