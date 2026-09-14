import { CatalogPage } from "@/views/CatalogPage";
import { pageSeo, JsonLd } from "@/lib/seo-page";
import { permanentRedirect } from "next/navigation";
import { fetchCatalogPageServer } from "@/lib/server-data";

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
  const { metadata } = await pageSeo(`/catalog${qs.size ? `?${qs}` : ""}`);
  return metadata;
}

export default async function Page() {
  const { jsonld, redirectTo } = await pageSeo(`/catalog`);
  // Legacy 301 (P0.2/P0.4): slug renames etc - from the page body.
  if (redirectTo) permanentRedirect(redirectTo);
  // P0.1: SSR первой страницы каталога теми же endpoint'ами, что у хуков.
  const { products, categories } = await fetchCatalogPageServer();
  return (
    <>
      <JsonLd blocks={jsonld} />
      <CatalogPage
        initialProducts={products ?? undefined}
        initialCategories={categories ?? undefined}
      />
    </>
  );
}
