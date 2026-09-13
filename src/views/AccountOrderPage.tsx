"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, FileText, Package } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/utils";
import { VatHint } from "@/components/common/Price";
import {
  downloadAccountDocument,
  fetchAccountOrder,
  type AccountOrderDetail,
} from "@/lib/api";
import { useAuth } from "@/store/auth";

export function AccountOrderPage() {
  const routeParams = useParams();
    const orderId = typeof routeParams.orderId === "string" ? routeParams.orderId : undefined;
  const { isAuthenticated } = useAuth();
  const [order, setOrder] = useState<AccountOrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId || !isAuthenticated) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchAccountOrder(orderId)
      .then((o) => {
        if (!cancelled) {
          setOrder(o);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Не удалось загрузить заказ");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="container-page py-10">
        <p className="text-body text-muted-foreground">
          <Link href="/account" className="font-semibold text-primary hover:underline">
            Войдите
          </Link>
          , чтобы видеть заказ.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container-page py-8 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container-page py-10">
        <p className="text-body text-destructive">{error || "Заказ не найден"}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/account/orders">К заказам</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container-page py-6 lg:py-8">
      <Breadcrumbs
        items={[
          { label: "Кабинет", href: "/account" },
          { label: "Заказы", href: "/account/orders" },
          { label: order.number },
        ]}
        className="mb-4"
      />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/account/orders">
            <ArrowLeft className="size-4" /> Назад
          </Link>
        </Button>
        <h1 className="text-h2">Заказ {order.number}</h1>
        <Badge variant={order.tone === "success" || order.tone === "warning" ? order.tone : "default"}>
          {order.status}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="surface-card p-5">
            <h2 className="text-h5">Состав</h2>
            <ul className="mt-3 divide-y divide-border">
              {order.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3 py-3">
                  <div>
                    <p className="text-body-sm font-medium">{i.name}</p>
                    <p className="text-caption text-muted-foreground">
                      {i.sku ? `${i.sku} · ` : ""}
                      {i.onRequest
                        ? `${i.qty} × под заказ`
                        : `${i.qty} × ${formatPrice(i.unitPrice)}`}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {i.onRequest && i.total === 0 ? "Под заказ" : formatPrice(i.total)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="surface-card p-5">
            <h2 className="text-h5">Статусы</h2>
            {order.statusHistory.length === 0 ? (
              <p className="mt-3 text-body-sm text-muted-foreground">Текущий статус: {order.status}</p>
            ) : (
              <ol className="mt-3 space-y-3">
                {order.statusHistory.map((h) => (
                  <li key={h.id} className="flex gap-3 text-body-sm">
                    <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                    <div>
                      <p className="font-medium">{h.to || order.status}</p>
                      {h.from ? (
                        <p className="text-caption text-muted-foreground">из «{h.from}»</p>
                      ) : null}
                      <p className="text-caption text-muted-foreground">{h.at}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="surface-card p-5">
            <h2 className="flex items-center gap-2 text-h5">
              <FileText className="size-5 text-primary" /> Документы
            </h2>
            {order.documents.length === 0 ? (
              <p className="mt-3 text-body-sm text-muted-foreground">Пока нет доступных документов.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {order.documents.map((d) => (
                  <li key={d.id}>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!d.downloadUrl}
                      onClick={() =>
                        void downloadAccountDocument(
                          d.downloadUrl,
                          d.title || d.typeName || "document",
                        )
                      }
                    >
                      {d.typeName || d.title || d.type || "Файл"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="surface-card h-fit p-5">
          <p className="flex items-center gap-2 text-h5">
            <Package className="size-5 text-primary" /> Итого
          </p>
          <p className="mt-2 text-caption text-muted-foreground">{order.date}</p>
          <dl className="mt-4 space-y-2 text-body-sm">
            {order.deliveryMethod ? (
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Доставка</dt>
                <dd>{order.deliveryMethod}</dd>
              </div>
            ) : null}
            {order.paymentMethod ? (
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Оплата</dt>
                <dd>{order.paymentMethod}</dd>
              </div>
            ) : null}
            {order.shippingAmount > 0 ? (
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Доставка, ₽</dt>
                <dd>{formatPrice(order.shippingAmount)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-2 border-t border-border pt-2 text-h5">
              <dt>К оплате</dt>
              <dd className="text-right tabular-nums">
                <span className="block">{formatPrice(order.total)}</span>
                <VatHint />
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
