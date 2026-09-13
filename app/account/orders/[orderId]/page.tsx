import { AccountOrderPage } from "@/views/AccountOrderPage";
import { pageSeo, JsonLd } from "@/lib/seo-page";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ orderId: string }> };

export async function generateMetadata({ params }: Props) {
  const { orderId } = await params;
  const { metadata } = await pageSeo(`/account/orders/${orderId}`, `/account/orders/${orderId}`);
  return metadata;
}

export default async function Page({ params }: Props) {
  const { orderId } = await params;
  const { jsonld } = await pageSeo(`/account/orders/${orderId}`, `/account/orders/${orderId}`);
  return (
    <>
      <JsonLd blocks={jsonld} />
      <AccountOrderPage />
    </>
  );
}
