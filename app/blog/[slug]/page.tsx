import { ArticlePage } from "@/views/ArticlePage";
import { pageSeo, JsonLd } from "@/lib/seo-page";
import { notFound, permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  // redirect_to is NOT handled here: redirect from generateMetadata
  // is unsupported in Next 16 (crashes Server Components render).
  const { metadata } = await pageSeo(`/blog/${slug}`, `/blog/${slug}`);
  return metadata;
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const { jsonld, redirectTo, notFound: isMissing } = await pageSeo(`/blog/${slug}`, `/blog/${slug}`);
  // Legacy 301 (P0.2/P0.4): slug renames etc - from the page body.
  if (redirectTo) permanentRedirect(redirectTo);
  // P0.2: неизвестная статья → настоящий 404.
  if (isMissing) notFound();
  return (
    <>
      <JsonLd blocks={jsonld} />
      <ArticlePage />
    </>
  );
}
