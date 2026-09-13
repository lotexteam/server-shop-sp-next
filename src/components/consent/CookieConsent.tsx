"use client";

import { useState } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";
import { useConsent } from "@/hooks/useConsent";
import {
  cookiesPolicyHref,
  decideConsent,
  privacyPolicyHref,
} from "@/lib/consent/consent";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

/**
 * Полупрозрачный cookie-баннер (блок А ТЗ 152-ФЗ).
 *
 * Показывается до первого решения пользователя; до решения аналитика и
 * маркетинг заблокированы (см. lib/consent/consent.ts). Согласие
 * принимается один раз и действует consent_ttl_days (по ТЗ 365 дней);
 * повтор — по истечении срока или после очистки данных браузера.
 * «Настроить» открывает панель категорий: технические — обязательны,
 * аналитические и маркетинговые — на усмотрение пользователя.
 */
export function CookieConsent() {
  const { phase, config, choice } = useConsent();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);

  const banner = config?.banner;
  const modal = config?.settings;

  if (phase === "loading" || phase === "disabled" || !config?.enabled || !banner || !modal) {
    return null;
  }

  // Решение принято (и панель не вызвана повторно из подвала) — UI не нужен.
  if (phase === "decided" && !settingsOpen) {
    return null;
  }

  const openSettings = () => {
    setAnalytics(choice?.analytics ?? config.defaults?.analytics ?? true);
    setMarketing(choice?.marketing ?? config.defaults?.marketing ?? false);
    setSettingsOpen(true);
  };

  const acceptAll = () => {
    decideConsent({ analytics: true, marketing: true }, "cookie_accepted");
    setSettingsOpen(false);
  };

  const saveSettings = () => {
    decideConsent({ analytics, marketing }, "cookie_custom");
    setSettingsOpen(false);
  };

  return (
    <>
      {banner.custom_css ? <style>{banner.custom_css}</style> : null}

      {!settingsOpen && (
        <div
          className="no-print pointer-events-none fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4"
          role="region"
          aria-label="Использование файлов cookie"
          data-consent-banner
        >
          <div
            className="pointer-events-auto mx-auto flex max-w-5xl flex-col gap-3 rounded-2xl border border-white/10 p-4 shadow-elevated backdrop-blur-lg sm:flex-row sm:items-center sm:gap-4 sm:p-5"
            style={{ backgroundColor: banner.bg, color: banner.text_color }}
          >
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <Cookie className="mt-0.5 size-5 shrink-0 opacity-80" aria-hidden />
              <div className="min-w-0">
                <p className="text-body-sm leading-relaxed opacity-95">{banner.text}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption opacity-80">
                  <a href={privacyPolicyHref()} target="_blank" rel="noreferrer" className="underline underline-offset-2 transition-opacity hover:opacity-80">
                    Политика конфиденциальности
                  </a>
                  <a href={cookiesPolicyHref()} target="_blank" rel="noreferrer" className="underline underline-offset-2 transition-opacity hover:opacity-80">
                    Политика использования cookie
                  </a>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
              {/* Не блокирует просмотр контента, но обязателен выбор; высота 44px+ для мобильных */}
              <Button
                type="button"
                size="lg"
                className="h-11 w-full whitespace-nowrap text-white hover:brightness-110 sm:w-auto"
                style={{ backgroundColor: banner.accent_color }}
                onClick={acceptAll}
              >
                {banner.accept_label}
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="h-11 w-full whitespace-nowrap border-white/30 bg-white/10 text-foreground hover:bg-white/20 sm:w-auto"
                style={{ color: banner.text_color }}
                onClick={openSettings}
              >
                {banner.customize_label}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto" data-consent-settings>
          <DialogHeader>
            <DialogTitle>{modal.title}</DialogTitle>
            <DialogDescription>{modal.description}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {(
              [
                ["necessary", true],
                ["analytics", false],
                ["marketing", false],
              ] as const
            ).map(([key, locked]) => {
              const category = modal.categories[key];
              const checked =
                key === "necessary" ? true : key === "analytics" ? analytics : marketing;
              return (
                <div key={key} className="flex items-start justify-between gap-4 rounded-xl border border-border bg-secondary/40 p-4">
                  <div className="min-w-0">
                    <p className="text-body-sm font-semibold">{category.label}</p>
                    <p className="mt-1 text-caption leading-relaxed text-muted-foreground">{category.description}</p>
                  </div>
                  <Switch
                    checked={checked}
                    disabled={locked}
                    onCheckedChange={(value) => {
                      if (key === "analytics") setAnalytics(value);
                      if (key === "marketing") setMarketing(value);
                    }}
                    aria-label={category.label}
                    className="mt-0.5"
                  />
                </div>
              );
            })}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <a href={cookiesPolicyHref()} target="_blank" rel="noreferrer" className="text-caption text-muted-foreground underline underline-offset-2 hover:text-foreground">
                Подробнее в политике cookie
              </a>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="h-11 sm:h-9" onClick={acceptAll}>
                  {banner.accept_label}
                </Button>
                <Button
                  type="button"
                  variant="gradient"
                  size="sm"
                  className="h-11 sm:h-9"
                  onClick={saveSettings}
                >
                  {modal.save_label}
                </Button>
              </div>
            </div>

            <Link href={privacyPolicyHref()} className="text-caption text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => setSettingsOpen(false)}>
              Политика конфиденциальности
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
