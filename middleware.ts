import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type SeoDocumentResponse = {
  data?: { kind?: string } | null;
};

const SEO_PATH = /^\/(product|catalog|blog)\/[^/]+(?:\/[^/]*)?$/;

async function isMissingPage(request: NextRequest): Promise<boolean> {
  const apiBase = (process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
  if (!apiBase) return false;

  const path = request.nextUrl.pathname + request.nextUrl.search;
  const url = `${apiBase}/seo/document?path=${encodeURIComponent(path)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-Seo-Site": request.nextUrl.origin,
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const payload = (await response.json()) as SeoDocumentResponse;
    return payload.data?.kind === "not_found";
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (SEO_PATH.test(pathname) && await isMissingPage(request)) {
    return new NextResponse(
      "<!doctype html><html lang=\"ru\"><head><meta charset=\"utf-8\"><meta name=\"robots\" content=\"noindex,follow\"><title>Страница не найдена</title></head><body><h1>Страница не найдена</h1><p>Проверьте адрес или перейдите в каталог.</p><p><a href=\"/\">На главную</a> · <a href=\"/catalog\">В каталог</a></p></body></html>",
      {
        status: 404,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "X-Robots-Tag": "noindex, follow",
          "Cache-Control": "no-store",
        },
      },
    );
  }

  if (pathname === "/") {
    const hasCookie = request.cookies.size > 0;
    const response = NextResponse.next();

    if (!hasCookie) {
      response.headers.set(
        "Cache-Control",
        "public, s-maxage=300, stale-while-revalidate=600, max-age=60",
      );
    } else {
      response.headers.set("Cache-Control", "private, no-cache, must-revalidate");
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/product/:path*", "/catalog/:path*", "/blog/:path*"],
};
