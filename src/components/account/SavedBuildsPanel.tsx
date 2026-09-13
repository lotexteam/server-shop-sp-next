"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Save,
  Trash2,
  ShoppingCart,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { formatPrice } from "@/lib/utils";
import {
  apiBuildToCart,
  apiDeleteBuild,
  apiEnableBuildShare,
  apiListBuilds,
  storefrontShareUrl,
  type ApiSavedBuild,
} from "@/lib/api";

export function SavedBuildsPanel() {
  const { push } = useToast();
  const [list, setList] = useState<ApiSavedBuild[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { list: rows } = await apiListBuilds({ per_page: 50 });
      setList(rows);
    } catch (e) {
      push({
        variant: "error",
        title: "Не удалось загрузить сборки",
        description: e instanceof Error ? e.message : "Ошибка API",
      });
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    void load();
  }, [load]);

  const onDelete = async (id: string) => {
    setBusyId(id);
    try {
      await apiDeleteBuild(id);
      setList((prev) => prev.filter((b) => b.id !== id));
      push({ variant: "info", title: "Сборка удалена" });
    } catch (e) {
      push({
        variant: "error",
        title: "Удаление не удалось",
        description: e instanceof Error ? e.message : "Ошибка",
      });
    } finally {
      setBusyId(null);
    }
  };

  const onCart = async (b: ApiSavedBuild) => {
    setBusyId(b.id);
    try {
      await apiBuildToCart(b.id, 1);
      push({
        variant: "success",
        title: "Сборка в корзине",
        description: b.number || b.name,
      });
    } catch (e) {
      push({
        variant: "error",
        title: "Не удалось добавить в корзину",
        description: e instanceof Error ? e.message : "Ошибка",
      });
    } finally {
      setBusyId(null);
    }
  };

  const onShare = async (b: ApiSavedBuild) => {
    setBusyId(b.id);
    try {
      let token = b.is_public ? b.share_token : null;
      let path = b.is_public ? b.share_path : null;
      if (!token) {
        const shared = await apiEnableBuildShare(b.id);
        token = shared.share_token;
        path = shared.share_path;
        setList((prev) =>
          prev.map((x) => (x.id === b.id ? { ...x, ...shared } : x)),
        );
      }
      if (!token && !path) {
        throw new Error("Нет share_token");
      }
      const url = storefrontShareUrl(path || token!);
      try {
        await navigator.clipboard.writeText(url);
        push({
          variant: "success",
          title: "Ссылка скопирована",
          description: "Открывается без входа в аккаунт",
        });
      } catch {
        push({
          variant: "success",
          title: "Ссылка для шаринга",
          description: url,
        });
      }
    } catch (e) {
      push({
        variant: "error",
        title: "Не удалось создать ссылку",
        description: e instanceof Error ? e.message : "Ошибка",
      });
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" /> Загрузка сборок…
      </div>
    );
  }

  if (!list.length) {
    return (
      <EmptyState
        icon={Save}
        title="Нет сохранённых сборок"
        description="Соберите сервер в конфигураторе и сохраните сборку в личном кабинете."
        action={
          <Button asChild variant="gradient">
            <Link href="/catalog">В каталог</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {list.map((b) => {
        const total = Number(b.total_display ?? b.total_amount) || 0;
        const productHref = b.parent_product?.slug
          ? `/product/${b.parent_product.slug}`
          : b.parent_product_id
            ? `/product/${b.parent_product_id}`
            : "/catalog";
        const busy = busyId === b.id;
        return (
          <div
            key={b.id}
            className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-card sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-body font-semibold">{b.name}</p>
                {b.number ? (
                  <Badge variant="muted" className="font-mono text-caption">
                    {b.number}
                  </Badge>
                ) : null}
                {b.is_valid === false ? (
                  <Badge variant="warning" className="gap-1">
                    <AlertTriangle className="size-3" /> невалидна
                  </Badge>
                ) : (
                  <Badge variant="outline">OK</Badge>
                )}
              </div>
              <p className="mt-0.5 text-caption text-muted-foreground">
                {b.parent_product?.name || "Конфигурация"}
                {b.created_at
                  ? ` · ${new Date(b.created_at).toLocaleDateString("ru-RU")}`
                  : ""}
              </p>
              <p className="mt-2 text-h5 font-bold tabular-nums">
                {formatPrice(total)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={productHref}>
                  <ExternalLink className="size-4" /> Открыть
                </Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void onShare(b)}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Share2 className="size-4" />
                )}
                Ссылка
              </Button>
              <Button
                size="sm"
                variant="gradient"
                disabled={busy || b.is_valid === false}
                onClick={() => void onCart(b)}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ShoppingCart className="size-4" />
                )}
                В корзину
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => void onDelete(b.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
