import { NextResponse } from "next/server";

/**
 * AI agent readiness: llms.txt file for AI assistants citation quality.
 * Fully proxies to backend API endpoint - all content managed through admin UI.
 * @see https://llmstxt.org/
 */
export async function GET() {
  const apiBase = (
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  ).replace(/\/$/, "");

  if (!apiBase) {
    return new NextResponse("API not configured", {
      status: 503,
      headers: {
        "Content-Type": "text/plain; charset=UTF-8",
        "Cache-Control": "no-store",
      },
    });
  }

  try {
    const backendUrl = `${apiBase}/llms.txt`;
    const response = await fetch(backendUrl, {
      headers: {
        Accept: "text/plain",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 404) {
        return new NextResponse("Not found", {
          status: 404,
          headers: {
            "Content-Type": "text/plain; charset=UTF-8",
          },
        });
      }
      throw new Error(`Backend returned ${response.status}`);
    }

    const content = await response.text();

    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=UTF-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error) {
    console.error("Error fetching llms.txt from backend:", error);

    return new NextResponse("Service unavailable", {
      status: 503,
      headers: {
        "Content-Type": "text/plain; charset=UTF-8",
        "Cache-Control": "no-store",
      },
    });
  }
}
