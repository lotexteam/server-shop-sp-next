import { PrivacyWithdrawPage } from "@/views/PrivacyWithdrawPage";
import { pageSeo, JsonLd } from "@/lib/seo-page";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { metadata } = await pageSeo("/privacy/withdraw", "/privacy/withdraw");
  return metadata;
}

export default async function Page() {
  const { jsonld } = await pageSeo("/privacy/withdraw", "/privacy/withdraw");
  return (
    <>
      <JsonLd blocks={jsonld} />
      <PrivacyWithdrawPage />
    </>
  );
}
