import { SharedBuildPage } from "@/views/SharedBuildPage";
import { pageSeo, JsonLd } from "@/lib/seo-page";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props) {
  const { token } = await params;
  const { metadata } = await pageSeo(`/build/${token}`, `/build/${token}`);
  return metadata;
}

export default async function Page({ params }: Props) {
  const { token } = await params;
  const { jsonld } = await pageSeo(`/build/${token}`, `/build/${token}`);
  return (
    <>
      <JsonLd blocks={jsonld} />
      <SharedBuildPage />
    </>
  );
}
