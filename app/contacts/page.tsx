import { ContactsPage } from "@/views/ContactsPage";
import { pageSeo, JsonLd } from "@/lib/seo-page";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { metadata } = await pageSeo("/contacts", "/contacts");
  return metadata;
}

export default async function Page() {
  const { jsonld } = await pageSeo("/contacts", "/contacts");
  return (
    <>
      <JsonLd blocks={jsonld} />
      <ContactsPage />
    </>
  );
}
