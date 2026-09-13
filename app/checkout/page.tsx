import { CheckoutPage } from "@/views/CheckoutPage";
import { pageSeo, JsonLd } from "@/lib/seo-page";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { metadata } = await pageSeo("/checkout", "/checkout");
  return metadata;
}

export default async function Page() {
  const { jsonld } = await pageSeo("/checkout", "/checkout");
  return (
    <>
      <JsonLd blocks={jsonld} />
      <CheckoutPage />
    </>
  );
}
