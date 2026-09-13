import { ProductPage } from "@/views/ProductPage";
import { pageSeo, JsonLd } from "@/lib/seo-page";

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
  const path = `/product/${slug}${qs.size ? `?${qs}` : ""}`;
  const { metadata } = await pageSeo(path, `/product/${slug}`);
  return metadata;
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const { jsonld } = await pageSeo(`/product/${slug}`, `/product/${slug}`);
  return (
    <>
      <JsonLd blocks={jsonld} />
      <ProductPage />
    </>
  );
}
