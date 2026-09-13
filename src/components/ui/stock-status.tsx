"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function StockStatus({ onRequest, className }: { onRequest: boolean; className?: string }) {
  if (onRequest) {
    return (
      <p className={cn("text-caption font-medium text-destructive", className)}>Под заказ</p>
    );
  }

  return (
    <p className={cn("inline-flex items-center gap-1.5 text-caption font-medium text-success", className)}>
      <Check className="size-3.5 stroke-[2.5]" aria-hidden />
      Доступен к заказу
    </p>
  );
}
