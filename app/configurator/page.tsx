import { ConfiguratorPage } from "@/views/ConfiguratorPage";
import { pageSeo, JsonLd } from "@/lib/seo-page";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { metadata } = await pageSeo("/configurator", "/configurator");
  return metadata;
}

export default async function Page() {
  const { jsonld } = await pageSeo("/configurator", "/configurator");
  return (
    <>
      <JsonLd blocks={jsonld} />
      <ConfiguratorPage />
    </>
  );
}
