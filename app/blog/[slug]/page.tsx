import { ArticlePage } from "@/views/ArticlePage";
import { pageSeo, JsonLd } from "@/lib/seo-page";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const { metadata } = await pageSeo(`/blog/${slug}`, `/blog/${slug}`);
  return metadata;
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const { jsonld } = await pageSeo(`/blog/${slug}`, `/blog/${slug}`);
  return (
    <>
      <JsonLd blocks={jsonld} />
      <ArticlePage />
    </>
  );
}
