"use client";

import { Fragment } from "react";
import { Phone, Truck, ShieldCheck, MapPin } from "lucide-react";
import { useContacts } from "@/hooks/useContacts";
import { useHomeContent } from "@/hooks/useHomeContent";

export function TopBar() {
  const { contacts } = useContacts();
  const { content: home } = useHomeContent();

  // Home CMS is the source of truth. Empty slot = hide (no contacts/demo fallback).
  const delivery = home
    ? home.topbarLines[0] || null
    : contacts?.topbar.delivery?.trim() || null;
  const warranty = home
    ? home.topbarLines[1] || null
    : contacts?.topbar.warranty?.trim() || null;
  const address = contacts?.address?.trim() || null;
  const phone = contacts?.phone?.trim() || null;
  // Все номера из CMS (Настройки → Контакты), первый — основной
  const phones = (contacts?.phones?.length
    ? contacts.phones
    : phone
      ? [phone]
      : []
  ).map((p) => ({ label: p, href: `tel:${p.replace(/\D+/g, "")}` }));

  // Reserve the bar height on first paint: when contacts/CMS arrive later,
  // the bar must not push the whole page down (layout shift).
  if (!delivery && !warranty && !address && phones.length === 0) {
    return (
      <div
        data-chrome="topbar"
        aria-hidden
        className="site-topbar bg-foreground text-background"
      >
        <div className="h-[var(--topbar-h)]" />
      </div>
    );
  }

  return (
    <div data-chrome="topbar" className="site-topbar bg-foreground text-background">
      <div className="container-page flex h-[var(--topbar-h)] items-center justify-between text-caption">
        <div className="flex min-w-0 items-center gap-6">
          {delivery && (
            <span className="flex items-center gap-1.5">
              <Truck className="size-3.5 shrink-0" /> {delivery}
            </span>
          )}
          {warranty && (
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 shrink-0" /> {warranty}
            </span>
          )}
          {address && (
            <span className="flex min-w-0 items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">{address}</span>
            </span>
          )}
        </div>
        {phones.length > 0 && (
          <span className="flex shrink-0 items-center gap-1.5">
            {phones.map((p, i) => (
              <Fragment key={p.href}>
                {i > 0 && <span className="opacity-60">·</span>}
                <a
                  href={p.href}
                  className="flex items-center gap-1.5 font-semibold transition-opacity hover:opacity-80"
                >
                  {i === 0 && <Phone className="size-3.5" />} {p.label}
                </a>
              </Fragment>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
