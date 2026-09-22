"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronDown, Cpu, Star, Quote } from "lucide-react";
import { Section, SectionHeader, Reveal } from "@/components/common/Section";
import { WhyStorySection } from "@/components/home/WhyStorySection";
import { HeroVideoStage } from "@/components/home/HeroVideoStage";
import { LinkedText } from "@/components/common/LinkedText";
import { CatalogCategories } from "@/components/home/CatalogCategories";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { useShop } from "@/store/shop";
import { useToast } from "@/components/ui/toast";
import { useHomeHighlights } from "@/hooks/useCatalogProducts";
import { useHomeContent } from "@/hooks/useHomeContent";
import { useContacts } from "@/hooks/useContacts";
import { useCategories } from "@/hooks/useCategories";
import { fetchBlogPosts, categoryHref } from "@/lib/api";
import type { Article, Product } from "@/data/types";
import { useEffect, useState } from "react";
import { useMenu } from "@/hooks/useMenu";

const NEXT_SECTION_ID = "why-story";

function scrollToNextSection() {
  document.getElementById(NEXT_SECTION_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const brands = ["Dell", "HPE", "Intel", "AMD", "Supermicro", "Lenovo", "Cisco", "NVIDIA"];

export function HomePage({ initialProducts }: { initialProducts?: Product[] }) {
  const router = useRouter();
  const { addToCart, toggleFav } = useShop();
  const { push } = useToast();
  const products = useHomeHighlights(initialProducts);
  const { content: cmsHome } = useHomeContent();
  const { contacts } = useContacts();
  const { categories } = useCategories();
  const { items: homeCats, loading: homeCatsLoading } = useMenu("home");
  const [articles, setArticles] = useState<Article[]>([]);
  // Отзывы и FAQ — из CMS (GET /settings/home), без локальных заглушек
  const faqList = cmsHome?.faq ?? [];
  const reviewList = cmsHome?.reviews ?? [];

  // Тексты главной — из CMS (settings/home). Правило витрины: стёрли текст
  // в админке — блок/элемент не рендерится (никаких захардкоженных дефолтов).
  const hero = cmsHome?.hero;
  const heroTitle = {
    prefix: hero?.titlePrefix || "",
    highlight: hero?.titleHighlight || "",
    suffix: hero?.titleSuffix || "",
  };
  const heroStats: Array<{ value: string; label: string }> = hero?.stats ?? [];
  const sec = cmsHome?.sections;
  const secText = (key: keyof NonNullable<typeof sec>) => ({
    eyebrow: sec?.[key]?.eyebrow || "",
    title: sec?.[key]?.title || "",
    action: sec?.[key]?.action || "",
  });
  const hasText = (t: { eyebrow: string; title: string; action?: string }): boolean =>
    t.eyebrow.trim() !== "" || t.title.trim() !== "" || (t.action ?? "").trim() !== "";
  const secCategories = secText("categories");
  const secHotDeals = secText("hotDeals");
  const secBestsellers = secText("bestsellers");
  const secReviews = secText("reviews");
  const secBlog = secText("blog");
  const secFaq = secText("faq");
  const banner = cmsHome?.banner;
  const bannerHasText = Boolean(
    banner?.title?.trim() || banner?.subtitle?.trim() || banner?.cta?.trim() || banner?.href?.trim(),
  );
  const cta = cmsHome?.cta;
  const ctaHasText = Boolean(
    cta?.title?.trim() || cta?.subtitle?.trim() || cta?.primary?.trim() || cta?.secondary?.trim(),
  );
  // Основной телефон — первый из списка CMS (Настройки → Контакты)
  const primaryPhone = contacts?.phones?.[0] || contacts?.phone || null;
  const phoneHref = primaryPhone
    ? `tel:${primaryPhone.replace(/\D+/g, "")}`
    : null;
  // One small API page instead of the full catalog: hot → hits fallback
  const catalog = products;
  const hot = catalog.filter((p) => p.oldPrice).slice(0, 4);
  const hits = (hot.length ? hot : catalog).slice(0, 4);
  const bestsellers = (hot.length ? catalog.filter((p) => !hot.includes(p)) : catalog).slice(0, 4);

  useEffect(() => {
    void fetchBlogPosts({ per_page: 4 })
      .then((res) => setArticles(res.items))
      .catch(() => setArticles([]));
  }, []);

  const add = (p: Product) => { addToCart(p); push({ variant: "success", title: "Добавлено в корзину", description: p.title, action: { label: "Перейти к оформлению", onClick: () => router.push("/checkout") } }); };
  const fav = (p: Product) => { toggleFav(p); push({ variant: "info", title: "Избранное обновлено" }); };

  return (
    <>
      {/*
        Shared video stage for hero + story:
        sticky under chrome, content pulled over it (.hero-pull).
        One continuous background while scrolling both banners.
      */}
      <div className="relative bg-[#120c28]">
        <HeroVideoStage />

        <div className="hero-pull relative z-10">
          <section
            className="hero-fit relative flex flex-col overflow-hidden"
            aria-label="Главный баннер"
          >
            <div
              className="container-page relative flex min-h-0 flex-1 flex-col justify-center overflow-hidden lg:grid lg:grid-cols-2 lg:items-center lg:gap-10"
              style={{ paddingTop: "var(--hero-pad-y)", paddingBottom: "var(--hero-pad-y)" }}
            >
              <div className="min-h-0 max-w-2xl">
                <div className="hero-fade-in min-h-0">
                  {hero?.badge ? (
                    <Badge
                      variant="gradient"
                      className="shadow-sm"
                      style={{
                        marginBottom: "var(--hero-gap-md)",
                        fontSize: "var(--hero-badge)",
                      }}
                    >
                      {hero.badge}
                    </Badge>
                  ) : null}
                  {heroTitle.prefix || heroTitle.highlight || heroTitle.suffix ? (
                    <h1 className="hero-fit-title text-white">
                      {heroTitle.prefix}
                      {heroTitle.highlight ? (
                        <>
                          {" "}
                          <span className="text-gradient-on-dark">{heroTitle.highlight}</span>
                        </>
                      ) : null}
                      {heroTitle.suffix ? <> {heroTitle.suffix}</> : null}
                    </h1>
                  ) : null}
                  {hero?.subtitle ? (
                    <p
                      className="hero-fit-lead max-w-lg text-white/80"
                      style={{ marginTop: "var(--hero-gap-md)" }}
                    >
                      <LinkedText
                        segments={cmsHome?.textSegments?.["hero.subtitle"]}
                        fallback={hero.subtitle}
                        linkClassName="text-white underline decoration-primary underline-offset-2 hover:text-primary"
                      />
                    </p>
                  ) : null}
                  <div
                    className="flex flex-wrap gap-2 sm:gap-3"
                    style={{ marginTop: "var(--hero-gap-lg)" }}
                  >
                    <Button
                      asChild
                      size="lg"
                      variant="gradient"
                      className="h-auto min-h-10 px-4 py-2.5 text-white sm:min-h-11 sm:px-5"
                      style={{ fontSize: "var(--hero-btn)" }}
                    >
                      {/^https?:\/\//i.test(hero?.ctaCatalogHref ?? "") ? (
                        <a href={hero?.ctaCatalogHref}>
                          {hero?.ctaCatalog || "Перейти в каталог"}{" "}
                          <ArrowRight className="size-4 shrink-0" />
                        </a>
                      ) : (
                        <Link href={hero?.ctaCatalogHref?.trim() || "/catalog"}>
                          {hero?.ctaCatalog || "Перейти в каталог"} <ArrowRight className="size-4 shrink-0" />
                        </Link>
                      )}
                    </Button>
                    <Button
                      asChild
                      size="lg"
                      variant="outline"
                      className="h-auto min-h-10 border-white/35 bg-white/10 px-4 py-2.5 text-white backdrop-blur-sm hover:border-white/55 hover:bg-white/20 hover:text-white sm:min-h-11 sm:px-5"
                      style={{ fontSize: "var(--hero-btn)" }}
                    >
                      {/^https?:\/\//i.test(hero?.ctaConfiguratorHref ?? "") ? (
                        <a href={hero?.ctaConfiguratorHref}>
                          <Cpu className="size-4 shrink-0" /> {hero?.ctaConfigurator || "Собрать сервер"}
                        </a>
                      ) : (
                        <Link
                           href={
                            hero?.ctaConfiguratorHref?.trim() ||
                            "/product/dell-poweredge-r740"
                          }
                        >
                          <Cpu className="size-4 shrink-0" /> {hero?.ctaConfigurator || "Собрать сервер"}
                        </Link>
                      )}
                    </Button>
                  </div>
                  {heroStats.length > 0 && (
                    <div
                      className="hero-fit-stats flex flex-wrap gap-x-6 gap-y-2 sm:gap-x-8"
                      style={{ marginTop: "var(--hero-gap-xl)" }}
                    >
                      {heroStats.map((s) => (
                        <div key={s.label}>
                          <div className="hero-fit-stat text-white">{s.value}</div>
                          <div className="text-caption text-white/70">{s.label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div
              className="relative flex shrink-0 flex-col items-center"
              style={{
                paddingBottom: "clamp(0.5rem, 1.8vh, 2rem)",
                paddingTop: "clamp(0.15rem, 0.6vh, 0.5rem)",
              }}
            >
              <button
                type="button"
                onClick={scrollToNextSection}
                aria-label="Перейти к следующему блоку"
                className="group flex flex-col items-center gap-1 text-white/80 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#120c28] max-[480px]:scale-90 hero-bounce"
              >
                <span className="text-caption font-medium tracking-wide text-white/60 group-hover:text-white/90">
                  {hero?.scrollHint || "Узнать больше"}
                </span>
                <span className="flex size-9 items-center justify-center rounded-full border border-white/30 bg-white/10 shadow-[0_0_24px_rgba(245,86,136,0.25)] backdrop-blur-sm transition-colors group-hover:border-white/50 group-hover:bg-white/20 sm:size-11">
                  <ChevronDown className="size-4 sm:size-5" strokeWidth={2.25} />
                </span>
              </button>
            </div>
          </section>

          <div id={NEXT_SECTION_ID} className="scroll-mt-[var(--chrome-h)]">
            <WhyStorySection />
          </div>
        </div>
      </div>

      {/* CATEGORIES: CMS menu `home`; пока меню пустое — все корневые категории.
          Правило CMS: нет текстов секции или контента — секция не рендерится. */}
      {hasText(secCategories) && (homeCatsLoading || homeCats.length > 0 || categories.length > 0) ? (
      <Section className="bg-background">
        <SectionHeader
          eyebrow={secCategories.eyebrow}
          title={secCategories.title}
          action={secCategories.action ? { label: secCategories.action, href: "/catalog" } : undefined}
        />
        <CatalogCategories />
      </Section>
      ) : null}

      {/* HOT DEALS */}
      {hasText(secHotDeals) && (
      <div className="bg-secondary/60">
        <Section>
          <SectionHeader eyebrow={secHotDeals.eyebrow} title={secHotDeals.title} action={secHotDeals.action ? { label: secHotDeals.action, href: "/catalog" } : undefined} />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {hits.length === 0
              ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={`hs-${i}`} />)
              : hits.map((p, i) => (
                  <Reveal key={p.id} delay={i * 0.05}>
                    <ProductCard product={p} onAdd={add} onFav={fav} />
                  </Reveal>
                ))}
          </div>
        </Section>
      </div>
      )}

      {/* CONFIGURATOR BANNER — стёрли текста в CMS, баннер пропадает */}
      {bannerHasText && (
      <Section>
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl bg-brand-gradient p-8 text-white shadow-elevated lg:p-14">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.18),transparent_55%)]" />
            <div className="relative z-10 max-w-xl">
              {banner?.title ? <h2 className="text-h2 text-white">{banner.title}</h2> : null}
              {banner?.subtitle ? (
                <p className="mt-3 text-body-lg text-white/90">
                  <LinkedText
                    segments={cmsHome?.textSegments?.["configurator_banner.subtitle"]}
                    fallback={banner.subtitle}
                    linkClassName="text-white underline decoration-primary underline-offset-2 hover:text-primary"
                  />
                </p>
              ) : null}
              <Button asChild size="lg" variant="secondary" className="mt-6 border-0 bg-white text-primary hover:bg-white/95">
                {/^https?:\/\//i.test(banner?.href ?? "") ? (
                  <a href={banner?.href}>
                    <Cpu className="size-4" /> {banner?.cta || "Конфигуратор"}
                  </a>
                ) : (
                  <Link href={banner?.href?.trim() || categoryHref("konfigurator")}>
                    <Cpu className="size-4" /> {banner?.cta || "Конфигуратор"}
                  </Link>
                )}
              </Button>
            </div>
            <div className="pointer-events-none absolute -right-8 -top-8 opacity-10">
              <Cpu className="size-64 text-white" aria-hidden />
            </div>
          </div>
        </Reveal>
      </Section>
      )}

      {/* BESTSELLERS */}
      {hasText(secBestsellers) && (
      <Section className="!pt-0">
        <SectionHeader eyebrow={secBestsellers.eyebrow} title={secBestsellers.title} action={secBestsellers.action ? { label: secBestsellers.action, href: "/catalog" } : undefined} />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {bestsellers.length === 0
            ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={`bs-${i}`} />)
            : bestsellers.map((p, i) => (
                <Reveal key={p.id} delay={i * 0.05}>
                  <ProductCard product={p} onAdd={add} onFav={fav} />
                </Reveal>
              ))}
        </div>
      </Section>
      )}

      {/* BRANDS */}
      <div className="border-y border-border bg-card">
        <Section className="!py-10">
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
            {brands.map((b) => (
              <span
                key={b}
                className="text-h5 font-bold text-muted-foreground/45 transition-colors hover:text-primary"
              >
                {b}
              </span>
            ))}
          </div>
        </Section>
      </div>

      {/* REVIEWS — из CMS (settings/home); нет отзывов или текстов — секции нет */}
      {reviewList.length > 0 && hasText(secReviews) && (
      <Section>
        <SectionHeader eyebrow={secReviews.eyebrow} title={secReviews.title} />
        <div className="grid gap-5 md:grid-cols-3">
          {reviewList.map((r, i) => (
            <Reveal key={r.id} delay={i * 0.06}>
              <div className="surface-card h-full p-6">
                <Quote className="size-8 text-primary/25" aria-hidden />
                <div className="mt-3 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star
                      key={s}
                      className={`size-4 ${s < r.rating ? "fill-warning text-warning" : "text-border"}`}
                    />
                  ))}
                </div>
                <p className="mt-3 text-body-sm text-muted-foreground">{r.text}</p>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <span className="text-body-sm font-semibold text-foreground">{r.author}</span>
                  {r.verified && <Badge variant="success">Проверен</Badge>}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>
      )}

      {/* ARTICLES — нет статей или текстов секции, блока нет */}
      {articles.length > 0 && hasText(secBlog) && (
      <div className="bg-secondary/60">
        <Section>
          <SectionHeader eyebrow={secBlog.eyebrow} title={secBlog.title} action={secBlog.action ? { label: secBlog.action, href: "/blog" } : undefined} />
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {articles.map((a, i) => (
              <Reveal key={a.id} delay={i * 0.05}>
                <Link
                   href={`/blog/${a.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-card transition-shadow hover:shadow-card-hover"
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
                  <div className="flex flex-1 flex-col p-4">
                    <Badge variant="muted" className="w-fit">
                      {a.category}
                    </Badge>
                    <h3 className="mt-2 line-clamp-2 text-body font-semibold text-foreground group-hover:text-primary">
                      {a.title}
                    </h3>
                    <p className="mt-auto pt-3 text-caption text-muted-foreground">
                      {a.date} · {a.readingTime} мин
                    </p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </Section>
      </div>
      )}

      {/* FAQ — из CMS (settings/home); нет вопросов или текстов — секции нет */}
      {faqList.length > 0 && hasText(secFaq) && (
      <Section>
        <div className="max-w-3xl">
          <SectionHeader eyebrow={secFaq.eyebrow} title={secFaq.title} />
          <Accordion type="single" collapsible className="surface-card px-6">
            {faqList.map((f) => (
              <AccordionItem key={f.q} value={f.q}>
                <AccordionTrigger>{f.q}</AccordionTrigger>
                <AccordionContent>{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </Section>
      )}

      {/* CTA — из CMS (settings/home); стёрли текста — блок пропадает */}
      {ctaHasText && (
      <Section className="!pt-0">
        <Reveal>
          <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-card lg:p-16">
            {cta?.title ? <h2 className="text-h2 text-foreground">{cta.title}</h2> : null}
            {cta?.subtitle ? (
              <p className="mx-auto mt-3 max-w-xl text-body-lg text-muted-foreground">{cta.subtitle}</p>
            ) : null}
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              {cta?.primary ? (
                <Button asChild size="lg" variant="gradient">
                  <Link href="/contacts">{cta.primary}</Link>
                </Button>
              ) : null}
              {cta?.secondary && phoneHref ? (
                <Button asChild size="lg" variant="outline">
                  <a href={phoneHref}>{cta.secondary}</a>
                </Button>
              ) : null}
            </div>
          </div>
        </Reveal>
      </Section>
      )}
    </>
  );
}

function ProductCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card" aria-hidden>
      <div className="aspect-[16/10] animate-pulse bg-secondary" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-3/4 animate-pulse rounded bg-secondary" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-secondary" />
      </div>
    </div>
  );
}
