import { fetchSiteServer } from "@/lib/seo-server";

/**
 * /manifest.webmanifest — PWA-манифест.
 * Раньше путь проваливался в фолбэк-страницу сайта и отдавал HTML 200
 * (technical-bad-content-type / soft-404). Имя, бренд и описание берём из
 * настроек сайта (CMS), а не из констант витрины.
 */
export async function GET() {
  const site = await fetchSiteServer();
  const name = (site?.brand || site?.title || "").trim();
  const description = (site?.description || "").trim();

  const manifest = {
    ...(name ? { name } : {}),
    ...(name ? { short_name: name } : {}),
    ...(description ? { description } : {}),
    lang: "ru",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#3DCC93",
    categories: ["shopping", "business"],
    icons: [
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      ...(site?.logoUrl ? [{ src: site.logoUrl, sizes: "any", type: "image/webp", purpose: "any" }] : []),
    ],
    shortcuts: [
      { name: "Каталог", url: "/catalog" },
      { name: "Конфигуратор", url: "/configurator" },
      { name: "Контакты", url: "/contacts" },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    status: 200,
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
