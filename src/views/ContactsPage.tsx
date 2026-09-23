"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  Building2,
  Send,
  Loader2,
} from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { ConsentCheckbox } from "@/components/consent/ConsentCheckbox";
import { logConsent } from "@/lib/consent/consent";
import { useContacts } from "@/hooks/useContacts";
import { setHtmlWithScripts } from "@/lib/injectHtml";
import { cn } from "@/lib/utils";
import {
  submitContactRequest,
  StorefrontApiError,
  type ShopOrganization,
} from "@/lib/api";

// MapLibre GL тянет браузер-only CSS/JS — подключаем без SSR.
const ContactsMapLibre = dynamic(
  () =>
    import("@/components/common/ContactsMapLibre").then(
      (m) => m.ContactsMapLibre,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 w-full min-h-[18rem] animate-pulse rounded-lg bg-muted lg:h-full" />
    ),
  },
);

function orgRows(org: ShopOrganization): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  if (org.legalName) rows.push(["Наименование", org.legalName]);
  if (org.inn || org.kpp) {
    rows.push([
      "ИНН / КПП",
      [org.inn, org.kpp].filter(Boolean).join(" / "),
    ]);
  }
  if (org.ogrn) rows.push(["ОГРН", org.ogrn]);
  if (org.legalAddress) rows.push(["Юр. адрес", org.legalAddress]);
  if (org.bankAccount) rows.push(["Р/с", org.bankAccount]);
  if (org.bankName) rows.push(["Банк", org.bankName]);
  if (org.bankBik) rows.push(["БИК", org.bankBik]);
  if (org.bankCorrAccount) rows.push(["Корр. счёт", org.bankCorrAccount]);
  return rows;
}

export function ContactsPage() {
  const { push } = useToast();
  const { contacts, loading } = useContacts();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  // Согласие 152-ФЗ для формы обратной связи (блок Б ТЗ).
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState(false);

  const cards = useMemo(() => {
    if (!contacts) return [];
    const list: Array<{
      icon: typeof Phone;
      title: string;
      value: string;
      href?: string;
    }> = [];
    // Карточка на каждый номер из CMS (Настройки → Контакты)
    const phoneList = contacts.phones?.length
      ? contacts.phones
      : contacts.phone
        ? [contacts.phone]
        : [];
    phoneList.forEach((p, i) => {
      list.push({
        icon: Phone,
        title: i === 0 ? "Телефон" : `Телефон ${i + 1}`,
        value: p,
        href: `tel:${p.replace(/\D+/g, "")}`,
      });
    });
    if (contacts.email) {
      list.push({
        icon: Mail,
        title: "Email",
        value: contacts.email,
        href: `mailto:${contacts.email}`,
      });
    }
    if (contacts.address) {
      list.push({
        icon: MapPin,
        title: "Адрес",
        value: contacts.address,
      });
    }
    if (contacts.workHours) {
      list.push({
        icon: Clock,
        title: "Часы работы",
        value: contacts.workHours,
      });
    }
    return list;
  }, [contacts]);

  const requisites = useMemo(
    () => (contacts ? orgRows(contacts.organization) : []),
    [contacts],
  );

  const faq = contacts?.faq ?? [];
  const mapEmbed = contacts?.mapEmbed?.trim() || "";
  const ml = contacts?.maplibre;
  // Провайдер выбирается в админке (Настройки → Контакты → Карта).
  // maplibre без координат не рендерим — остаётся iframe-фолбэк.
  const useMaplibre =
    contacts?.mapProvider === "maplibre" &&
    typeof ml?.lat === "number" &&
    typeof ml?.lng === "number";
  const hasMap = useMaplibre || mapEmbed !== "";

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    const p = phone.trim();
    const em = email.trim();
    if (!n) {
      push({ variant: "error", title: "Укажите имя" });
      return;
    }
    if (!p && !em) {
      push({
        variant: "error",
        title: "Укажите телефон или email",
      });
      return;
    }
    if (!consent) {
      // Согласие 152-ФЗ обязательно (блок Б ТЗ).
      setConsentError(true);
      document.getElementById("feedback-consent")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setConsentError(false);
    setSending(true);
    try {
      const res = await submitContactRequest({
        name: n,
        phone: p || undefined,
        email: em || undefined,
        message: message.trim() || undefined,
        source: "contacts_page",
      });
      push({
        variant: "success",
        title: "Заявка отправлена",
        description: res.message || "Мы свяжемся с вами в ближайшее время",
      });
      // Фиксируем согласие из формы обратной связи (блок Г ТЗ).
      void logConsent("feedback_consent");
      setName("");
      setPhone("");
      setEmail("");
      setMessage("");
      setConsent(false);
    } catch (err) {
      const msg =
        err instanceof StorefrontApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Не удалось отправить заявку";
      push({ variant: "error", title: "Ошибка", description: msg });
    } finally {
      setSending(false);
    }
  };

  if (loading && !contacts) {
    return (
      <div className="container-page py-6 lg:py-8 space-y-6">
        <Skeleton className="h-8 w-40" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-6 lg:py-8">
      <Breadcrumbs items={[{ label: "Контакты" }]} className="mb-4" />
      <h1 className="mb-6 text-h2">Контакты</h1>

      {cards.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <div key={c.title} className="surface-card p-5">
              <span className="flex size-11 items-center justify-center rounded-md bg-brand-gradient-soft text-primary">
                <c.icon className="size-5" />
              </span>
              <p className="mt-3 text-caption font-semibold uppercase text-muted-foreground">
                {c.title}
              </p>
              {c.href ? (
                <a
                  href={c.href}
                  className="text-body font-semibold hover:text-primary"
                >
                  {c.value}
                </a>
              ) : (
                <p className="text-body font-semibold">{c.value}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-body-sm text-muted-foreground">
          Контакты пока не заполнены в админке (Настройки → Контакты).
        </p>
      )}

      <div className={cn("mt-8 grid gap-6", hasMap ? "lg:grid-cols-2" : "")}>
        {useMaplibre ? (
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
            <ContactsMapLibre
              lat={ml!.lat!}
              lng={ml!.lng!}
              zoom={ml!.zoom ?? 15}
              title={ml!.title}
              style={ml!.style}
              styleUrl={ml!.styleUrl}
            />
          </div>
        ) : mapEmbed ? (
          <ContactsMapEmbed html={mapEmbed} />
        ) : null}

        <form className="surface-card p-6" onSubmit={(e) => void onSubmit(e)}>
          <h2 className="text-h4">Обратная связь</h2>
          <p className="mt-1 text-body-sm text-muted-foreground">
            Оставьте заявку — инженер перезвонит и поможет с выбором.
          </p>
          <div className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cn">Имя</Label>
                <Input
                  id="cn"
                  required
                  placeholder="Иван"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={sending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp">Телефон</Label>
                <Input
                  id="cp"
                  type="tel"
                  placeholder="+7 (___) ___-__-__"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={sending}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ce">Email</Label>
              <Input
                id="ce"
                type="email"
                placeholder="mail@example.ru"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={sending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cm">Сообщение</Label>
              <textarea
                id="cm"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={sending}
                className="w-full rounded-md border border-input bg-card px-3.5 py-2.5 text-body-sm shadow-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                placeholder="Опишите задачу…"
              />
            </div>
            <ConsentCheckbox
              id="feedback-consent"
              checked={consent}
              onChange={(checked) => {
                setConsent(checked);
                if (checked) setConsentError(false);
              }}
              error={consentError}
            />
            <Button
              type="submit"
              variant="gradient"
              size="lg"
              className="w-full"
              disabled={sending}
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {sending ? "Отправка…" : "Отправить заявку"}
            </Button>
          </div>
        </form>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="surface-card p-6">
          <h2 className="flex items-center gap-2 text-h4">
            <Building2 className="size-5 text-primary" /> Реквизиты
          </h2>
          {requisites.length > 0 ? (
            <dl className="mt-4 space-y-2.5 text-body-sm">
              {requisites.map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between gap-3 border-b border-border pb-2 last:border-0"
                >
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-4 text-body-sm text-muted-foreground">
              Реквизиты организации не заполнены (Настройки → Контакты →
              Реквизиты).
            </p>
          )}
        </div>
        <div>
          <h2 className="mb-3 text-h4">Частые вопросы</h2>
          {faq.length > 0 ? (
            <Accordion type="single" collapsible className="surface-card px-6">
              {faq.map((item) => (
                <AccordionItem key={item.q} value={item.q}>
                  <AccordionTrigger>{item.q}</AccordionTrigger>
                  <AccordionContent>{item.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <p className="surface-card p-6 text-body-sm text-muted-foreground">
              FAQ пока пуст — добавьте вопросы в админке (Настройки → Контакты
              → FAQ).
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ContactsMapEmbed({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) setHtmlWithScripts(ref.current, html);
  }, [html]);
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
      <div
        ref={ref}
        className="h-72 w-full min-h-[18rem] lg:h-full [&>iframe]:block [&>iframe]:h-72 [&>iframe]:w-full lg:[&>iframe]:h-full"
      />
    </div>
  );
}
