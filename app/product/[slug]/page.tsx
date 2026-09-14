import { ProductPage } from "@/views/ProductPage";
import { pageSeo, JsonLd } from "@/lib/seo-page";
import { fetchProductServer } from "@/lib/server-data";
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
  const { metadata } = await pageSeo(`/product/${slug}${qs.size ? `?${qs}` : ""}`, `/product/${slug}`);
  return metadata;
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const { jsonld, redirectTo, notFound: isMissing } = await pageSeo(`/product/${slug}`, `/product/${slug}`);
  // Legacy 301 (P0.2/P0.4): slug renames etc - from the page body.
  if (redirectTo) permanentRedirect(redirectTo);
  // P0.2: SeoDocumentBuilder сказал not_found → честный HTTP 404 вместо 200.
  if (isMissing) notFound();
  // Серверный SSR контента: тот же endpoint /products/{slug}, что и клиентский
  // fetchProduct. API недоступен → null → отдаём клиенту самому догрузить,
  // а не подменяем страницу 404 (не путаем сбой витринного API с ошибкой адреса).
  const initialProduct = await fetchProductServer(slug);
  return (
    <>
      <JsonLd blocks={jsonld} />
      <ProductPage initialProduct={initialProduct} />
    </>
  );
}
