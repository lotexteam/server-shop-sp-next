"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Clock, ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { absoluteMediaUrl, fetchBlogPost, fetchBlogPosts } from "@/lib/api";
import type { Article } from "@/data/types";
import { NotFoundPage } from "./NotFoundPage";
import { usePageMeta } from "@/components/layout/DocumentHead";
import { useSiteSettings } from "@/hooks/useSiteSettings";

/** Ссылки на файлы (*.pdf, *.jpg…) открываются как документы, а не маршруты SPA. */
function isFileHref(href: string): boolean {
  try {
    const u = new URL(href, "http://local.invalid");
    return /\.[a-z0-9]+$/i.test(u.pathname);
  } catch {
    return false;
  }
}

export function ArticlePage() {
  const routeParams = useParams();
    const slug = typeof routeParams.slug === "string" ? routeParams.slug : undefined;
  const { site } = useSiteSettings();
  const [article, setArticle] = useState<
    (Article & { bodyMarkdown?: string }) | null | undefined
  >(undefined);
  const [related, setRelated] = useState<Article[]>([]);
  usePageMeta(article?.title ?? null);

  useEffect(() => {
    if (!slug) {
      setArticle(null);
      return;
    }
    let cancelled = false;
    setArticle(undefined);
    void (async () => {
      const post = await fetchBlogPost(slug);
      if (cancelled) return;
      setArticle(post);
      if (!post) return;
      try {
        const res = await fetchBlogPosts({ per_page: 8 });
        if (!cancelled) {
          setRelated(res.items.filter((a) => a.id !== post.id).slice(0, 3));
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (article === undefined) {
    return (
      <div className="container-page py-10 space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="aspect-[16/9] w-full rounded-lg" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!article) return <NotFoundPage />;

  const body = article.bodyMarkdown || article.excerpt || "";

  return (
    <div className="container-page py-6 lg:py-8">
      <Breadcrumbs
        items={[{ label: "Блог", href: "/blog" }, { label: article.title }]}
        className="mb-5"
      />
      <div className="grid gap-10 lg:grid-cols-[1fr_260px]">
        <article className="max-w-3xl">
          <Badge variant="gradient">{article.category}</Badge>
          <h1 className="mt-3 text-h1">{article.title}</h1>
          <div className="mt-4 flex items-center gap-4 text-body-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="size-4" /> {article.readingTime} мин чтения
            </span>
            <span>{article.date}</span>
          </div>
          {article.cover && (
            <img
              src={article.cover}
              alt=""
              className="mt-6 aspect-[16/9] w-full rounded-lg border border-border object-cover"
            />
          )}

          {/* Форматирование приходит из блога: markdown body_markdown (+ raw HTML: <details>, .blog-pdf-grid) */}
          <div className="mt-8 max-w-none text-body leading-relaxed text-muted-foreground [&>*+*]:mt-4">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                h2: ({ children }) => <h2 className="pt-4 text-h3 text-foreground">{children}</h2>,
                h3: ({ children }) => <h3 className="pt-3 text-h4 text-foreground">{children}</h3>,
                ul: ({ children }) => <ul className="list-disc space-y-1.5 pl-6">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal space-y-1.5 pl-6">{children}</ol>,
                // Разворачиваемый блок с текстом: <details><summary>…</summary>…</details>
                details: ({ children }) => (
                  <details className="rounded-lg border border-border bg-card px-4 py-3 open:pb-4">
                    {children}
                  </details>
                ),
                summary: ({ children }) => (
                  <summary className="cursor-pointer select-none py-1 font-semibold text-foreground transition-colors hover:text-primary">
                    {children}
                  </summary>
                ),
                // Внутренние маршруты — через роутер; внешние ссылки и файлы — в новой вкладке
                a: ({ children, href }) => {
                  const cls = "text-primary underline-offset-2 hover:underline";
                  if (href && href.startsWith("/") && !isFileHref(href)) {
                    return (
                      <Link href={href} className={cls}>
                        {children}
                      </Link>
                    );
                  }
                  return (
                    <a href={href} target="_blank" rel="noreferrer" className={cls}>
                      {children}
                    </a>
                  );
                },
                // Относительные пути картинок из CMS резолвим относительно API
                img: ({ src, alt }) => {
                  const url = typeof src === "string" ? absoluteMediaUrl(src) : null;
                  return url ? <img src={url} alt={alt ?? ""} loading="lazy" /> : null;
                },
                strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-border pl-4 italic">{children}</blockquote>
                ),
              }}
            >
              {body}
            </ReactMarkdown>
          </div>

          {!article.hideAuthor && (
            <div className="mt-10 flex items-center gap-4 rounded-lg border border-border bg-card p-5">
              {(article.author || site?.brand) && (
                <div className="flex size-14 items-center justify-center rounded-full bg-brand-gradient text-h5 font-bold text-white">
                  {(article.author || site?.brand || "?")[0]}
                </div>
              )}
              <div>
                <p className="text-body font-semibold">{article.author || site?.brand}</p>
                <p className="text-body-sm text-muted-foreground">
                  {site?.brand ? `Материал ${site.brand}` : "Эксперт по серверным платформам"}
                </p>
              </div>
            </div>
          )}

          <Button asChild variant="outline" className="mt-8">
            <Link href="/blog">
              <ArrowLeft className="size-4" /> Все статьи
            </Link>
          </Button>
        </article>

        <aside className="hidden lg:block">
          <div className="sticky-below-header space-y-6">
            {related.length > 0 && (
              <div className="surface-card p-5">
                <h3 className="text-h6">Читайте также</h3>
                <div className="mt-3 space-y-3">
                  {related.map((a) => (
                    <Link
                      key={a.id}
                       href={`/blog/${a.slug}`}
                      className="block text-body-sm font-medium transition-colors hover:text-primary"
                    >
                      {a.title}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
