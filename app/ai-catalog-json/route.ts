import { NextResponse } from "next/server";

/**
 * AI agent readiness: ai-catalog.json for machine-readable site structure.
 * Fully proxies to backend API endpoint - all content managed through admin UI.
 */
export async function GET() {
  const apiBase = (
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  ).replace(/\/$/, "");

  if (!apiBase) {
    return NextResponse.json(
      { error: "API not configured" },
      {
        status: 503,
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          "Cache-Control": "no-store",
        },
      }
    );
  }

  try {
    const backendUrl = `${apiBase}/ai-catalog.json`;
    const response = await fetch(backendUrl, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: "Not found" },
          {
            status: 404,
            headers: {
              "Content-Type": "application/json; charset=UTF-8",
            },
          }
        );
      }
      throw new Error(`Backend returned ${response.status}`);
    }

    const catalog = await response.json();

    return NextResponse.json(catalog, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error) {
    console.error("Error fetching ai-catalog.json from backend:", error);

    return NextResponse.json(
      { error: "Service unavailable" },
      {
        status: 503,
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
