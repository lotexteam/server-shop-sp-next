import { AccountOrderPage } from "@/views/AccountOrderPage";
import { pageSeo, JsonLd } from "@/lib/seo-page";
import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ orderId: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { orderId } = await params;
  // redirect_to is NOT handled here: redirect from generateMetadata
  // is unsupported in Next 16 (crashes Server Components render).
  const { metadata } = await pageSeo(`/account/orders/${orderId}`, `/account/orders/${orderId}`);
  return metadata;
}

export default async function Page({ params }: Props) {
  const { orderId } = await params;
  const { jsonld, redirectTo } = await pageSeo(`/account/orders/${orderId}`, `/account/orders/${orderId}`);
  // Legacy 301 (P0.2/P0.4): slug renames etc - from the page body.
  if (redirectTo) permanentRedirect(redirectTo);
  return (
    <>
      <JsonLd blocks={jsonld} />
      <AccountOrderPage />
    </>
  );
}
