"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Rating({ value, reviews, className }: { value: number; reviews?: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-1 text-body-sm", className)}>
      <Star className="size-4 fill-warning text-warning" />
      <span className="font-semibold text-foreground">{value.toFixed(1)}</span>
      {reviews !== undefined && <span className="text-muted-foreground">({reviews})</span>}
    </div>
  );
}
