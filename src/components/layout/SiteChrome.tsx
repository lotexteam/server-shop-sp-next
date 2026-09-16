"use client";

/**
 * Клиентская «обвязка» сайта — прямой перенос RootLayout из SPA-версии
 * (server-shop-sp-ui/src/components/layout/RootLayout.tsx) с заменой
 * react-router-примитивов на next/link и next/navigation:
 *
 *  - <Outlet/> → {children} (в Next children прокидывает app/layout.tsx);
 *  - <ScrollRestoration/> удалён — Next восстанавливает скролл сам;
 *  - ErrorBoundary-обвязка → app/error.tsx / app/global-error.tsx;
 *  - PageMetaProvider → серверные метаданные + ClientHead.
 *
 * Провайдеры и порядок вложенности сохранены 1:1.
 */

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cog } from "lucide-react";
import { TopBar } from "./TopBar";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { ClientHead } from "./DocumentHead";
import { CompareBar } from "@/components/compare/CompareBar";
import { CookieConsent } from "@/components/consent/CookieConsent";
import { ShopProvider } from "@/store/shop";
import { AuthProvider } from "@/store/auth";
import { ToastProvider } from "../ui/toast";
import { TooltipProvider } from "../ui/tooltip";
import { useChromeHeightVar } from "@/hooks/useViewportFill";
import { initConsent } from "@/lib/consent/consent";

function Chrome() {
  useChromeHeightVar();
  return (
    <div
      data-chrome="chrome"
      className="site-chrome no-print sticky top-0 z-40 w-full shrink-0 self-start"
    >
      <TopBar />
      {/* Header использует useSearchParams — на статически пререндериваемых
          страницах (/_not-found) Next требует Suspense-границу. */}
      <Suspense
        fallback={<div className="h-[72px] w-full border-b border-border bg-card" />}
      >
        <Header />
      </Suspense>
    </div>
  );
}

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Плавающая кнопка «Конфигуратор» на мобильных (как в SPA):
  // не нужна на самом конфигураторе и на страницах товара — там своя панель сборки.
  const showConfiguratorFab =
    !pathname.startsWith("/configurator") && !pathname.startsWith("/product");

  // 152-ФЗ consent module: тот же вызов, что был в main.tsx до монтирования
  // React — решает, нужен ли cookie-баннер, и запускает аналитику только
  // при действующем согласии. No-op без API.
  useEffect(() => {
    void initConsent();
  }, []);

  return (
    <AuthProvider>
      <ShopProvider>
        <ToastProvider>
          <TooltipProvider delayDuration={200}>
            <div className="flex min-h-screen flex-col">
              <Chrome />
              <main className="flex-1">{children}</main>
              <div className="no-print">
                <Footer />
                <CompareBar />
              </div>
              {/* 152-ФЗ: cookie-баннер + панель настройки категорий */}
              <CookieConsent />
              {showConfiguratorFab && (
                <Link
                  href="/konfigurator"
                  className="fixed bottom-4 right-4 z-30 flex h-12 items-center gap-2 rounded-full bg-primary px-5 text-body-sm font-semibold uppercase tracking-wide text-primary-foreground shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition-colors hover:bg-primary/90 active:scale-95 lg:hidden"
                  aria-label="Открыть конфигуратор"
                >
                  <Cog className="size-5" />
                  Конфигуратор
                </Link>
              )}
            </div>
            <ClientHead />
          </TooltipProvider>
        </ToastProvider>
      </ShopProvider>
    </AuthProvider>
  );
}
