"use client";

import { useEffect, useState } from "react";
import { Gift, Lock } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/store/auth";
import { formatBonus, bonusWord } from "@/lib/bonuses";
import { apiPreviewBonusSpend, type BonusPreview } from "@/lib/api";
import { formatPrice, cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Props = {
  cartSubtotal: number;
  redeemEnabled: boolean;
  onRedeemEnabledChange: (v: boolean) => void;
  redeemAmount: number;
  onRedeemAmountChange: (v: number) => void;
};

export function BonusRedeemBlock({
  cartSubtotal,
  redeemEnabled,
  onRedeemEnabledChange,
  redeemAmount,
  onRedeemAmountChange,
}: Props) {
  const { isAuthenticated, bonusBalance } = useAuth();
  // Лимиты — только с сервера (группа покупателя): локальных 30%/5000/1% больше нет.
  const [preview, setPreview] = useState<BonusPreview | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    void apiPreviewBonusSpend(cartSubtotal, redeemEnabled ? redeemAmount : 0)
      .then((p) => {
        if (!cancelled) setPreview(p);
      })
      .catch(() => {
        if (!cancelled) setPreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, cartSubtotal, redeemEnabled, redeemAmount]);

  const max = preview?.maxSpendablePoints ?? 0;
  const willEarn = preview?.earnPreviewPoints ?? 0;
  const spendMaxPercent = preview?.spendMaxPercent;
  const spendMinOrder = preview?.spendMinOrderAmount;
  const earnPercent = preview?.earnPercent;

  useEffect(() => {
    if (redeemEnabled && redeemAmount > max) onRedeemAmountChange(max);
  }, [max, redeemAmount, redeemEnabled, onRedeemAmountChange]);

  if (!isAuthenticated) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-secondary/40 p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Lock className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-body-sm font-semibold">Бонусы для авторизованных</p>
            <p className="mt-1 text-caption text-muted-foreground">
              Войдите, чтобы списывать бонусы и получать кэшбэк за заказы.
            </p>
            <Button asChild size="sm" variant="gradient" className="mt-3 h-auto min-h-9 w-full max-w-full whitespace-normal break-words px-3 py-2 text-center text-white sm:w-auto">
              <Link href="/account">Войти и использовать бонусы</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const canRedeem = max > 0;
  const belowMin =
    cartSubtotal > 0 && spendMinOrder != null && cartSubtotal < spendMinOrder;

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-gradient text-white">
          <Gift className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-body-sm font-semibold">Бонусный счёт</p>
              <p className="text-caption text-muted-foreground">
                Доступно{" "}
                <Link href="/account/bonuses" className="font-semibold text-primary hover:underline">
                  {formatBonus(bonusBalance)} {bonusWord(bonusBalance)}
                </Link>{" "}
                · ≈ {formatPrice(bonusBalance)}
              </p>
            </div>
            <label
              className={cn(
                "flex items-center gap-2 text-body-sm font-medium",
                !canRedeem && "opacity-50"
              )}
            >
              <span className="text-caption text-muted-foreground sm:text-body-sm">Списать</span>
              <Switch
                checked={redeemEnabled && canRedeem}
                disabled={!canRedeem}
                onCheckedChange={(v) => {
                  onRedeemEnabledChange(v);
                  if (v) onRedeemAmountChange(max);
                  else onRedeemAmountChange(0);
                }}
              />
            </label>
          </div>

          {belowMin && spendMinOrder != null && (
            <p className="mt-2 text-caption text-warning-foreground">
              Списание доступно от суммы заказа {formatPrice(spendMinOrder)}
            </p>
          )}

          {!belowMin && max === 0 && bonusBalance === 0 && (
            <p className="mt-2 text-caption text-muted-foreground">
              Баланс пуст — бонусы появятся после оплаченных заказов.
            </p>
          )}

          {canRedeem && redeemEnabled && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="bonus-range" className="text-caption text-muted-foreground">
                  Списать:{" "}
                  <span className="font-semibold text-foreground">
                    {formatBonus(redeemAmount)} {bonusWord(redeemAmount)}
                  </span>{" "}
                  (−{formatPrice(redeemAmount)})
                </Label>
                <button
                  type="button"
                  className="text-caption font-semibold text-primary hover:underline"
                  onClick={() => onRedeemAmountChange(max)}
                >
                  Макс. {formatBonus(max)}
                </button>
              </div>
              <input
                id="bonus-range"
                type="range"
                min={0}
                max={max}
                step={0.01}
                value={Math.min(redeemAmount, max)}
                onChange={(e) =>
                  onRedeemAmountChange(Math.max(0, Math.min(max, Number(e.target.value) || 0)))
                }
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-primary/20 accent-primary"
              />
              <div className="flex justify-between text-caption text-muted-foreground">
                <span>0</span>
                <span>
                  {spendMaxPercent != null ? `до ${spendMaxPercent}% · ` : ""}макс. {formatBonus(max)}
                </span>
              </div>
            </div>
          )}

          {willEarn > 0 && (
            <p className="mt-3 text-caption text-muted-foreground">
              За этот заказ начислим ≈{" "}
              <strong className="text-foreground">
                {formatBonus(willEarn)} {bonusWord(willEarn)}
              </strong>
              {earnPercent != null ? ` (${earnPercent}% от оплаченных товаров)` : ""}
              {" "}после выполнения заказа
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
