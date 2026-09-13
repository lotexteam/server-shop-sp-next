"use client";

import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils";
import { useSiteSettings } from "@/hooks/useSiteSettings";

export function vatPriceHint(hint?: string | null): string {
  const t = (hint || "").trim();
  return t || "с НДС 5%";
}

export function VatHint({ className }: { className?: string }) {
  const { site } = useSiteSettings();
  return (
    <span className={cn("text-caption font-normal text-muted-foreground", className)}>
      {vatPriceHint(site?.vatPriceHint)}
    </span>
  );
}

/** Main storefront price: amount + «с НДС 5%» caption. No tax math. */
export function Price({
  value,
  className,
  amountClassName,
  hint = true,
}: {
  value: number;
  className?: string;
  amountClassName?: string;
  hint?: boolean;
}) {
  return (
    <span className={cn("inline-flex flex-col items-start", className)}>
      <span className={cn("tabular-nums", amountClassName)}>{formatPrice(value)}</span>
      {hint ? <VatHint /> : null}
    </span>
  );
}
