import { SharedBuildPage } from "@/views/SharedBuildPage";
import { pageSeo, JsonLd } from "@/lib/seo-page";
import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { token } = await params;
  // redirect_to is NOT handled here: redirect from generateMetadata
  // is unsupported in Next 16 (crashes Server Components render).
  const { metadata } = await pageSeo(`/build/${token}`, `/build/${token}`);
  return metadata;
}

export default async function Page({ params }: Props) {
  const { token } = await params;
  const { jsonld, redirectTo } = await pageSeo(`/build/${token}`, `/build/${token}`);
  // Legacy 301 (P0.2/P0.4): slug renames etc - from the page body.
  if (redirectTo) permanentRedirect(redirectTo);
  return (
    <>
      <JsonLd blocks={jsonld} />
      <SharedBuildPage />
    </>
  );
}
