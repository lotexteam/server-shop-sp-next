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
      `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,follow"><title>Страница не найдена — STORE-SERVER</title><style>
        :root{color-scheme:light;--brand:#0d5c63;--ink:#17343a;--muted:#6c8185;--line:#dce8e9;--surface:#fff;--background:#f4f8f8}
        *{box-sizing:border-box}body{margin:0;background:var(--background);color:var(--ink);font-family:Inter,Arial,sans-serif}main{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px 16px}.card{width:min(100%,680px);padding:48px 32px;text-align:center;background:var(--surface);border:1px solid var(--line);border-radius:24px;box-shadow:0 20px 60px rgba(23,52,58,.1)}.brand{display:inline-flex;align-items:center;gap:10px;margin-bottom:28px;color:var(--brand);font-size:18px;font-weight:800;letter-spacing:.08em;text-decoration:none}.brand img{width:42px;height:42px;object-fit:contain}.code{margin:0;color:var(--brand);font-size:clamp(96px,20vw,156px);font-weight:900;line-height:.85;letter-spacing:-.08em}.title{margin:24px 0 0;font-size:clamp(26px,5vw,40px);line-height:1.1}.text{max-width:450px;margin:16px auto 0;color:var(--muted);font-size:16px;line-height:1.6}.actions{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin-top:32px}.button{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 24px;border-radius:12px;font-size:15px;font-weight:700;text-decoration:none}.primary{background:var(--brand);color:#fff}.secondary{border:1px solid var(--line);color:var(--ink);background:#fff}@media(max-width:480px){.card{padding:36px 20px;border-radius:18px}.button{width:100%}}
      </style></head><body><main><section class="card"><a class="brand" href="/"><img src="/header_logo.svg" alt="STORE-SERVER">STORE-SERVER</a><p class="code">404</p><h1 class="title">Страница не найдена</h1><p class="text">Похоже, эта страница ушла на техобслуживание. Проверьте адрес или вернитесь в каталог.</p><nav class="actions"><a class="button primary" href="/">На главную</a><a class="button secondary" href="/catalog">В каталог</a></nav></section></main></body></html>`,
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
