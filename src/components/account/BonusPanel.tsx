"use client";

import Link from "next/link";
import { Gift, Sparkles, ArrowUpRight, ArrowDownLeft, Info, ShoppingBag } from "lucide-react";
import { useAuth } from "@/store/auth";
import {
  BONUS_RUB,
  formatBonus,
  bonusWord,
  type BonusTransaction,
} from "@/lib/bonuses";
import { formatPrice, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function formatTxDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function TxIcon({ type }: { type: BonusTransaction["type"] }) {
  if (type === "redeem" || type === "expire") {
    return (
      <span className="flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
        <ArrowUpRight className="size-5" />
      </span>
    );
  }
  return (
    <span className="flex size-10 items-center justify-center rounded-lg bg-success/10 text-success">
      <ArrowDownLeft className="size-5" />
    </span>
  );
}

export function BonusBalanceCard({ compact = false }: { compact?: boolean }) {
  const { isAuthenticated, bonusBalance } = useAuth();
  if (!isAuthenticated) return null;

  if (compact) {
    return (
      <Link
         href="/account/bonuses"
        className="flex items-center gap-3 rounded-lg bg-brand-gradient p-3 text-white transition-opacity hover:opacity-95"
      >
        <span className="flex size-10 items-center justify-center rounded-lg bg-white/15">
          <Gift className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-caption text-white/80">Бонусный счёт</p>
          <p className="text-h6 font-bold tabular-nums">
            {formatBonus(bonusBalance)}{" "}
            <span className="text-caption font-medium text-white/85">{bonusWord(bonusBalance)}</span>
          </p>
        </div>
        <span className="text-caption text-white/70">≈ {formatPrice(bonusBalance * BONUS_RUB)}</span>
      </Link>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-brand-gradient p-6 text-white shadow-elevated">
      <div className="pointer-events-none absolute -right-8 -top-8 size-40 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 left-10 size-32 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-body-sm font-medium text-white/85">
            <Sparkles className="size-4" /> Бонусный счёт
          </p>
          <p className="mt-2 text-display text-[2.75rem] font-extrabold tabular-nums leading-none lg:text-[3.25rem]">
            {formatBonus(bonusBalance)}
          </p>
          <p className="mt-2 text-body-sm text-white/80">
            {bonusWord(bonusBalance)} · 1 бонус = 1 ₽ · лимит списания зависит от группы
          </p>
        </div>
        <div className="rounded-xl bg-white/15 px-4 py-3 backdrop-blur-sm">
          <p className="text-caption text-white/75">Эквивалент</p>
          <p className="text-h4 font-bold">{formatPrice(bonusBalance * BONUS_RUB)}</p>
        </div>
      </div>
      <div className="relative mt-6 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="secondary" className="border-0 bg-white text-primary hover:bg-white/95">
          <Link href="/catalog">
            <ShoppingBag className="size-4" /> Копить на покупках
          </Link>
        </Button>
        <Button asChild size="sm" className="border border-white/30 bg-white/10 text-white hover:bg-white/20">
          <Link href="/checkout">Списать при оформлении</Link>
        </Button>
      </div>
    </div>
  );
}

export function BonusRules() {
  return (
    <div className="surface-card p-5">
      <h3 className="flex items-center gap-2 text-h6">
        <Info className="size-4 text-primary" /> Как это работает
      </h3>
      <ul className="mt-3 space-y-2.5 text-body-sm text-muted-foreground">
        <li className="flex gap-2">
          <Badge variant="default" className="mt-0.5 shrink-0">
            1
          </Badge>
          <span>
            За покупки начисляем бонусы от оплаченной суммы товаров
            (после списания) — процент зависит от вашей группы.
          </span>
        </li>
        <li className="flex gap-2">
          <Badge variant="default" className="mt-0.5 shrink-0">
            2
          </Badge>
          <span>
            Списание ограничено балансом и лимитом вашей группы.
            Доставка бонусами не оплачивается.
          </span>
        </li>
        <li className="flex gap-2">
          <Badge variant="default" className="mt-0.5 shrink-0">
            3
          </Badge>
          <span>
            Для списания может требоваться минимальная сумма заказа —
            точный лимит покажет корзина.
          </span>
        </li>
        <li className="flex gap-2">
          <Badge variant="default" className="mt-0.5 shrink-0">
            4
          </Badge>
          <span>
            Бонусы доступны только <strong className="text-foreground">авторизованным</strong> клиентам.
          </span>
        </li>
      </ul>
    </div>
  );
}

export function BonusHistoryList({ limit }: { limit?: number }) {
  const { bonusHistory } = useAuth();
  const list = limit ? bonusHistory.slice(0, limit) : bonusHistory;

  if (!list.length) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-body-sm text-muted-foreground">
        Операций пока нет — совершите покупку, чтобы копить бонусы.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {list.map((tx) => (
        <li key={tx.id} className="flex items-start gap-3 p-4">
          <TxIcon type={tx.type} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-body-sm font-semibold">{tx.title}</p>
                {tx.description && (
                  <p className="mt-0.5 text-caption text-muted-foreground">{tx.description}</p>
                )}
                {tx.orderId && (
                  <p className="mt-1 text-caption text-primary">Заказ {tx.orderId}</p>
                )}
              </div>
              <div className="text-right">
                <p
                  className={cn(
                    "text-body-sm font-bold tabular-nums",
                    tx.amount >= 0 ? "text-success" : "text-foreground"
                  )}
                >
                  {tx.amount >= 0 ? "+" : ""}
                  {formatBonus(tx.amount)}
                </p>
                <p className="text-caption text-muted-foreground">
                  остаток {formatBonus(tx.balanceAfter)}
                </p>
              </div>
            </div>
            <p className="mt-1.5 text-caption text-muted-foreground">{formatTxDate(tx.date)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function BonusTab() {
  return (
    <div className="space-y-5">
      <BonusBalanceCard />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div>
          <h2 className="mb-3 text-h5">История операций</h2>
          <BonusHistoryList />
        </div>
        <BonusRules />
      </div>
    </div>
  );
}
