import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/common/LegalPage";
import { fetchStaticPageServer } from "@/lib/static-pages";
import { fetchSiteServer, formatPageTitleServer } from "@/lib/seo-server";
import { fitDescription } from "@/lib/seo-page";

/** Текст страницы приходит из CMS (см. lib/static-pages.ts). */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [page, site] = await Promise.all([
    fetchStaticPageServer("editorial-policy"),
    fetchSiteServer(),
  ]);
  const title = formatPageTitleServer(page?.title || "Редакционная политика", site);
  // Описание = лид + первое положение страницы (оба текста из CMS), чтобы
  // уложиться в 120–160 символов без придуманного копирайта.
  const description = fitDescription(
    [page?.lead, page?.sections?.[0]?.paragraphs?.[0]].filter(Boolean).join(" "),
  ) || undefined;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: "/editorial-policy" },
    openGraph: {
      type: "article",
      title,
      description,
      url: "/editorial-policy",
      locale: "ru_RU",
    },
  };
}

export default async function EditorialPolicyPage() {
  const page = await fetchStaticPageServer("editorial-policy");
  if (!page) notFound();

  return <LegalPage title={page.title} lead={page.lead} updated={page.updated} sections={page.sections} />;
}
