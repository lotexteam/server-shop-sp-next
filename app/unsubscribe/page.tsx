import { UnsubscribePage } from "@/views/UnsubscribePage";
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
  const path = qs.size ? `/unsubscribe?${qs}` : "/unsubscribe";
  const { metadata } = await pageSeo(path, "/unsubscribe");
  return metadata;
}

export default async function Page() {
  const { jsonld } = await pageSeo("/unsubscribe", "/unsubscribe");
  return (
    <>
      <JsonLd blocks={jsonld} />
      <UnsubscribePage />
    </>
  );
}
