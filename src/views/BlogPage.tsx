"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Search } from "@/components/ui/search";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fetchBlogPosts } from "@/lib/api";
import type { Article } from "@/data/types";

export function BlogPage() {
  // Категория — в URL: пункты меню типа blog_category ведут на /blog?category={slug}
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const catParam = searchParams.get("category")?.trim() || "";
  const cat = catParam || "Все";
  const setCat = (c: string) => {
    const next = new URLSearchParams(searchParams);
    if (!c || c === "Все") next.delete("category");
    else next.set("category", c);
    // next/navigation не имеет setSearchParams — replace с новым query.
    const qs = next.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
  };
  const [q, setQ] = useState("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchBlogPosts({ per_page: 48 });
        if (!cancelled) setArticles(res.items);
      } catch {
        if (!cancelled) setArticles([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cats = useMemo(() => {
    const set = new Set(articles.map((a) => a.category).filter(Boolean));
    return ["Все", ...Array.from(set)];
  }, [articles]);

  // Фильтр по имени или slug/code рубрики (в меню приходит slug)
  const list = articles.filter(
    (a) =>
      (cat === "Все" || a.category === cat || a.categorySlug === cat) &&
      a.title.toLowerCase().includes(q.toLowerCase()),
  );
  const [featured, ...rest] = list;

  return (
    <div className="container-page py-6 lg:py-8">
      <Breadcrumbs items={[{ label: "Блог" }]} className="mb-4" />
      <div className="mb-8 max-w-2xl">
        <h1 className="text-h2">Блог</h1>
        <p className="mt-2 text-body text-muted-foreground">
          Гайды, аналитика и технологии серверного мира.
        </p>
      </div>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                "rounded-full px-4 py-1.5 text-body-sm font-medium transition-colors",
                cat === c ? "bg-primary text-white" : "bg-secondary hover:bg-muted",
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="sm:w-72">
          <Search
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onClear={() => setQ("")}
            placeholder="Поиск по статьям…"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-lg" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <p className="text-body text-muted-foreground">Статей пока нет.</p>
      ) : (
        <>
          {featured && (
            <Link
               href={`/blog/${featured.slug}`}
              className={cn(
                "group mb-8 overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-shadow hover:shadow-card-hover",
                featured.cover ? "grid md:grid-cols-2" : "block",
              )}
            >
              {featured.cover && (
                <div className="aspect-[16/10] overflow-hidden bg-secondary md:aspect-auto">
                  <img
                    src={featured.cover}
                    alt=""
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              )}
              <div className={cn("flex flex-col justify-center", featured.cover ? "p-8" : "p-8 md:p-10")}>
                <Badge variant="gradient" className="w-fit">
                  {featured.category}
                </Badge>
                <h2 className="mt-3 text-h3 group-hover:text-primary">{featured.title}</h2>
                <p className="mt-3 text-body text-muted-foreground">{featured.excerpt}</p>
                <p className="mt-4 text-caption text-muted-foreground">
                  {featured.author} · {featured.date} · {featured.readingTime} мин
                </p>
              </div>
            </Link>
          )}

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {rest.map((a) => (
              <Link
                key={a.id}
                 href={`/blog/${a.slug}`}
                className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-card transition-shadow hover:shadow-card-hover"
              >
                {a.cover && (
                  <div className="aspect-[16/10] overflow-hidden bg-secondary">
                    <img
                      src={a.cover}
                      alt=""
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                )}
                <div className="flex flex-1 flex-col p-5">
                  <Badge variant="muted" className="w-fit">
                    {a.category}
                  </Badge>
                  <h3 className="mt-2 text-h6 group-hover:text-primary">{a.title}</h3>
                  <p className="mt-2 line-clamp-2 text-body-sm text-muted-foreground">
                    {a.excerpt}
                  </p>
                  <p className="mt-auto pt-4 text-caption text-muted-foreground">
                    {a.date} · {a.readingTime} мин
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
