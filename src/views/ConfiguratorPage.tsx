"use client";

/**
 * /configurator — только редирект.
 * Конфигуратор = карточка товара с is_configurable (слоты type=product).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { fetchProducts } from "@/lib/api";

export function ConfiguratorPage() {
  const router = useRouter();
  const [slug, setSlug] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void fetchProducts({ per_page: 48 })
      .then((res) => {
        if (cancelled) return;
        const conf = res.items.find(
          (p) => p.isConfigurable && !p.slug.startsWith("cfg-opt-"),
        );
        setSlug(conf?.slug ?? null);
      })
      .catch(() => {
        if (!cancelled) setSlug(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // react-router <Navigate replace/>: в Next — эффект с router.replace
  // (редирект после клиентского определения slug).
  useEffect(() => {
    if (slug) router.replace(`/product/${slug}`);
  }, [slug, router]);

  if (slug === undefined) {
    return (
      <div className="container-page py-10">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-4 h-40 w-full rounded-xl" />
      </div>
    );
  }

  // slug известен — effect выше уже начал replace; рендерим скелет, чтобы
  // не мигал «Нет конфигурируемых товаров» перед уходом.
  if (slug) {
    return (
      <div className="container-page py-10" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-4 h-40 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="container-page py-10 text-center">
      <h1 className="text-h3">Нет конфигурируемых товаров</h1>
      <p className="mt-2 text-body text-muted-foreground">
        В каталоге пока нет платформ с конфигуратором.
      </p>
      <Button asChild variant="gradient" className="mt-6">
        <Link href="/catalog">В каталог</Link>
      </Button>
    </div>
  );
}
