import { AccountPage } from "@/views/AccountPage";
import { pageSeo, JsonLd } from "@/lib/seo-page";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { metadata } = await pageSeo("/account", "/account");
  return metadata;
}

export default async function Page() {
  const { jsonld } = await pageSeo("/account", "/account");
  return (
    <>
      <JsonLd blocks={jsonld} />
      <AccountPage />
    </>
  );
}
