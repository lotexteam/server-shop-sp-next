"use client";

/**
 * Public shared build: /build/:token
 * Opens configurator with selections — no login required.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Loader2, Share2 } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import {
  apiFetchSharedBuild,
  type ApiSavedBuild,
  StorefrontApiError,
} from "@/lib/api";

const SESSION_KEY = "server-price-shared-build";

/** Persist for ProductPage / ConfigurableProductView to pick up by share token. */
export function stashSharedBuild(build: ApiSavedBuild) {
  try {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        token: build.share_token,
        parent_product_id: build.parent_product_id,
        slug: build.parent_product?.slug,
        name: build.name,
        selections: build.selections || [],
        total_display: build.total_display,
      }),
    );
  } catch {
    /* ignore */
  }
}

export function takeSharedBuildForProduct(
  productIdOrSlug: string,
): { selections: Array<{ slot_id: string; product_id: string; qty: number }> } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as {
      parent_product_id?: string;
      slug?: string;
      selections?: Array<{ slot_id: string; product_id: string; qty: number }>;
    };
    if (
      data.parent_product_id === productIdOrSlug ||
      data.slug === productIdOrSlug
    ) {
      return { selections: data.selections || [] };
    }
    return null;
  } catch {
    return null;
  }
}

export function SharedBuildPage() {
  const routeParams = useParams();
    const token = typeof routeParams.token === "string" ? routeParams.token : "";
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [build, setBuild] = useState<ApiSavedBuild | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Некорректная ссылка");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void apiFetchSharedBuild(token)
      .then((b) => {
        if (cancelled) return;
        setBuild(b);
        stashSharedBuild(b);
        const slug = b.parent_product?.slug || b.parent_product_id;
        if (slug) {
          // Auto-open configurator with selections
          router.replace(`/product/${slug}?share=${encodeURIComponent(token)}`);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError(
          e instanceof StorefrontApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Сборка не найдена",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  if (loading) {
    return (
      <div className="container-page flex min-h-[40vh] flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
        <Loader2 className="size-8 animate-spin" />
        <p>Загрузка сборки…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-page py-10">
        <Breadcrumbs
          items={[{ label: "Каталог", href: "/catalog" }, { label: "Сборка" }]}
          className="mb-6"
        />
        <Alert variant="error" title="Ссылка недоступна">
          {error}
        </Alert>
        <Button asChild className="mt-4" variant="gradient">
          <Link href="/catalog">В каталог</Link>
        </Button>
      </div>
    );
  }

  // Fallback if no product slug (rare)
  return (
    <div className="container-page py-10">
      <Breadcrumbs
        items={[
          { label: "Каталог", href: "/catalog" },
          { label: build?.name || "Сборка" },
        ]}
        className="mb-6"
      />
      <div className="surface-card mx-auto max-w-lg p-6 text-center">
        <Share2 className="mx-auto mb-3 size-10 text-primary" />
        <h1 className="text-h3">{build?.name}</h1>
        {build?.number ? (
          <p className="mt-1 font-mono text-caption text-muted-foreground">
            {build.number}
          </p>
        ) : null}
        {build?.total_display != null ? (
          <p className="mt-3 text-h4 font-bold tabular-nums">
            {formatPrice(Number(build.total_display))}
          </p>
        ) : null}
        <Button asChild className="mt-6" variant="gradient">
          <Link href="/catalog">В каталог</Link>
        </Button>
      </div>
    </div>
  );
}
