import { Suspense } from "react";
import type { Metadata } from "next";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { fetchSiteServer, formatPageTitleServer } from "@/lib/seo-server";
import { MEDIA_BASE_URL } from "@/lib/api-base";
// Дизайн-токены + Tailwind: тот же файл, что был index.css в SPA.
import "@/index.css";

/**
 * Корневой layout — эквивалент index.html + RootLayout SPA-версии.
 *
 * Метаданные: базовые (фолбэк) значения генерируются из /settings/site —
 * как делали vite-плагин seoShellMeta (статические OG в shell) и
 * DocumentHead-фолбэки в SPA. Постраничные значения перекрывают их в
 * generateMetadata страниц (через /seo/document).
 */

export async function generateMetadata(): Promise<Metadata> {
  const site = await fetchSiteServer();
  const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");
  const title = formatPageTitleServer(null, site) || "Магазин серверного оборудования";
  const description = site?.description || "";
  const image = site?.ogImageUrl || site?.logoUrl || (appUrl ? `${appUrl}/favicon.svg` : "");
  const brand = site?.brand || "";

  return {
    ...(site?.titleSuffix
      ? {
          title: {
            default: title,
            // template применится только к простым строковым title дочерних
            // метаданных (SeoDocument-тайтлы идут как absolute — см. seo-page.tsx).
            template: `%s — ${site.titleSuffix}`,
          },
        }
      : { title }),
    description,
    ...(appUrl
      ? {
          metadataBase: new URL(appUrl),
          alternates: { canonical: "/" },
          openGraph: {
            type: "website",
            siteName: brand || undefined,
            locale: "ru_RU",
            url: "/",
            title,
            description: description || undefined,
            ...(image ? { images: [{ url: image, width: 512, height: 512, alt: brand || undefined }] } : {}),
          },
          twitter: {
            card: image ? "summary_large_image" : "summary",
            ...(image ? { images: [image] } : {}),
          },
        }
      : {}),
    icons: { icon: "/favicon.svg" },
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const mediaOrigin = (() => {
    const base = MEDIA_BASE_URL.replace(/\/$/, "");
    if (!base) return null;
    try {
      return new URL(base).origin;
    } catch {
      return null;
    }
  })();

  return (
    <html lang="ru">
      <head>
        {/* Эквивалент mediaPreconnect-плагина Vite: preconnect/dns-prefetch
            к origin хранилища картинок, если оно задано. */}
        {mediaOrigin && (
          <>
            <link rel="preconnect" href={mediaOrigin} crossOrigin="" />
            <link rel="dns-prefetch" href={mediaOrigin} />
          </>
        )}
        {/* Self-hosted Inter Variable: preload критичных подмножеств,
            font-display: optional зашит в CSS (как в vite-плагине inlineCss). */}
        <link
          rel="preload"
          href="/fonts/inter-cyrillic-wght-normal.woff2"
          as="font"
          type="font/woff2"
          crossOrigin=""
        />
        <link
          rel="preload"
          href="/fonts/inter-latin-wght-normal.woff2"
          as="font"
          type="font/woff2"
          crossOrigin=""
        />
        {/* Hero-постер (LCP): preload ровно того кандидата, который выберет
            <picture> в HeroVideoStage по тому же media — без srcset-угадывания
            (иначе Chrome ругался «preloaded but not used» и качал файл зря). */}
        <link
          rel="preload"
          as="image"
          href="/main-poster-800.webp"
          media="(max-width: 1023px)"
          fetchPriority="high"
        />
        <link
          rel="preload"
          as="image"
          href="/main-poster.webp"
          media="(min-width: 1024px)"
          fetchPriority="high"
        />
      </head>
      <body>
        {/* SSR отдаёт готовый HTML — loading-скелет #root:empty из index.html
            больше не нужен. noscript-фолбэк сохранён дословно.
            Suspense обязателен: страницы с useSearchParams (Catalog и др.)
            и статический /_not-found не могут пререндериться без boundary. */}
        <SiteChrome>
          <Suspense fallback={<div className="min-h-[60vh]" aria-busy="true" />}>
            {children}
          </Suspense>
        </SiteChrome>
        <noscript>
          <div>
            <p>
              Восстановленные серверы, процессоры и комплектующие
              enterprise-класса. Тестирование каждой единицы, гарантия и доставка
              по России. Для работы магазина включите JavaScript.
            </p>
            <ul>
              <li><a href="/catalog">Каталог</a></li>
              <li><a href="/blog">Блог</a></li>
              <li><a href="/contacts">Контакты</a></li>
            </ul>
          </div>
        </noscript>
      </body>
    </html>
  );
}
