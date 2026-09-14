import { CatalogPage } from "@/views/CatalogPage";
import { pageSeo, JsonLd } from "@/lib/seo-page";
import { fetchCatalogPageServer } from "@/lib/server-data";
import { notFound, permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const qs = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) =>
      v === undefined ? [] : Array.isArray(v) ? v.map((x) => [k, x] as [string, string]) : [[k, v] as [string, string]],
    ),
  );
  // redirect_to is NOT handled here: redirect from generateMetadata
  // is unsupported in Next 16 (crashes Server Components render).
  const { metadata } = await pageSeo(`/catalog/${slug}${qs.size ? `?${qs}` : ""}`, `/catalog/${slug}`);
  return metadata;
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const { jsonld, redirectTo, notFound: isMissing } = await pageSeo(`/catalog/${slug}`, `/catalog/${slug}`);
  // Legacy 301 (P0.2/P0.4): slug renames etc - from the page body.
  if (redirectTo) permanentRedirect(redirectTo);
  // P0.2: неизвестная категория → настоящий 404 (а не 200 с пустым каталогом).
  if (isMissing) notFound();
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
