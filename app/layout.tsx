import type { Metadata } from "next";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { fetchSiteServer, formatPageTitleServer } from "@/lib/seo-server";
import { fetchChromeContactsServer, fetchMenuColumnsServer } from "@/lib/chrome-server";
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
  // og:image обязателен (аудит 2026-11-20: social-og-image). В CMS og_image_url
  // и logo_url могут быть пусты — берём брендовый ассет самого скина.
  const DEFAULT_OG = "/header_logo.svg";
  const rawImage = site?.ogImageUrl || site?.logoUrl || null;
  const image = rawImage
    ? (rawImage.startsWith("http") ? rawImage : `${appUrl}${rawImage}`)
    : appUrl
      ? `${appUrl}${DEFAULT_OG}`
      : "";
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
            ...(image ? { images: [{ url: image, alt: brand || undefined }] } : {}),
          },
          twitter: {
            card: image ? "summary_large_image" : "summary",
            ...(image ? { images: [image] } : {}),
          },
        }
      : {}),
    // Манифест отдаёт route handler (app/manifest.webmanifest/route.ts).
    manifest: "/manifest.webmanifest",
    icons: { icon: "/header_logo.svg" },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Контакты и колонки подвала тянем на сервере: иначе телефон, email и адрес
  // появляются только после гидрации, и в первом HTML их нет (E-E-A-T, NAP).
  const [contacts, footerColumns] = await Promise.all([
    fetchChromeContactsServer(),
    fetchMenuColumnsServer("footer"),
  ]);
  const siteOrigin = (process.env.APP_URL || "").replace(/\/$/, "");
  const headerImage = siteOrigin ? `${siteOrigin}/header_logo.svg` : "/header_logo.svg";

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
        <link rel="preload" as="image" href={headerImage} fetchPriority="high" />
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
        {/* GEO: явная ссылка на llms.txt — аудит не находил её и считал,
            что llms.txt для AI-краулеров не объявлен (geo-llms-txt). */}
        <link rel="llms" href="/llms.txt" type="text/plain" />
      </head>
      <body>
        {/* SSR отдаёт готовый HTML — loading-скелет #root:empty из index.html
            больше не нужен. noscript-фолбэк сохранён дословно.
            app/loading.tsx намеренно отсутствует: route-level Suspense
            отправлял оболочку с HTTP 200 до готовности страницы — контент
            уезжал в <div hidden> (thin content), а notFound() превращался в
            soft-404. Без него страница рендерится целиком в первом ответе. */}
        <SiteChrome contacts={contacts} footerColumns={footerColumns}>
          {children}
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
