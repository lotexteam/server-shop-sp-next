"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Crumb { label: string; href?: string; }

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Хлебные крошки" className={cn("flex items-center gap-1.5 text-body-sm", className)}>
      <Link href="/" className="text-muted-foreground transition-colors hover:text-primary">
        <Home className="size-4" />
      </Link>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <ChevronRight className="size-4 text-muted-foreground/60" />
          {item.href && i < items.length - 1 ? (
            <Link href={item.href} className="text-muted-foreground transition-colors hover:text-primary">
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
