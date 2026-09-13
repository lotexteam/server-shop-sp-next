import { AccountPage } from "@/views/AccountPage";
import { pageSeo, JsonLd } from "@/lib/seo-page";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ tab: string }> };

export async function generateMetadata({ params }: Props) {
  const { tab } = await params;
  const { metadata } = await pageSeo(`/account/${tab}`, `/account/${tab}`);
  return metadata;
}

export default async function Page({ params }: Props) {
  const { tab } = await params;
  const { jsonld } = await pageSeo(`/account/${tab}`, `/account/${tab}`);
  return (
    <>
      <JsonLd blocks={jsonld} />
      <AccountPage />
    </>
  );
}
