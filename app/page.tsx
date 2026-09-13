import { HomePage } from "@/views/HomePage";
import { pageSeo, JsonLd } from "@/lib/seo-page";

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
  const path = qs.size ? `/?${qs}` : "/";
  const { metadata } = await pageSeo(path, "/");
  return metadata;
}

export default async function Page() {
  const { jsonld } = await pageSeo("/", "/");
  return (
    <>
      <JsonLd blocks={jsonld} />
      <HomePage />
    </>
  );
}
