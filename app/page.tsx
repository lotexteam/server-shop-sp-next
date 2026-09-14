import { HomePage } from "@/views/HomePage";
import { pageSeo, JsonLd } from "@/lib/seo-page";
import { permanentRedirect } from "next/navigation";
import { fetchProductsCached } from "@/lib/server-data";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: Props) {
  const sp = await searchParams;
  const qs = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) =>
      v === undefined ? [] : Array.isArray(v) ? v.map((x) => [k, x] as [string, string]) : [[k, v] as [string, string]],
    ),
  );
  // redirect_to is NOT handled here: redirect from generateMetadata
  // is unsupported in Next 16 (crashes Server Components render).
  const { metadata } = await pageSeo(`/${qs.size ? `?${qs}` : ""}`);
  return metadata;
}

export default async function Page() {
  const { jsonld, redirectTo } = await pageSeo(`/`);
  // Legacy 301 (P0.2/P0.4): slug renames etc - from the page body.
  if (redirectTo) permanentRedirect(redirectTo);
  // P0.1: SSR подборки главной — те же параметры, что у loadHomeHighlights
  // (одна страница /products, 24 шт, без чистых cfg-opt-* опций).
  const page1 = await fetchProductsCached(1, 24);
  const initialProducts = page1
    ? page1.items.filter((p) => !p.slug.startsWith("cfg-opt-"))
    : null;
  return (
    <>
      <JsonLd blocks={jsonld} />
      <HomePage initialProducts={initialProducts ?? undefined} />
    </>
  );
}
