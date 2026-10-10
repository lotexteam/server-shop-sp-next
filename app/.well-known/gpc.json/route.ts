export async function GET() {
  const apiBase = (
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  ).replace(/\/$/, "");

  if (!apiBase) {
    return new Response("API not configured", { status: 503 });
  }

  try {
    const backendUrl = `${apiBase}/.well-known/gpc.json`;
    const response = await fetch(backendUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 404) {
        return new Response("Not found", { status: 404 });
      }
      throw new Error(`Backend returned ${response.status}`);
    }

    const content = await response.json();

    return new Response(JSON.stringify(content), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (error) {
    console.error("Error fetching gpc.json from backend:", error);
    return new Response("Service unavailable", { status: 503 });
  }
}
