"use client";

import { cn } from "@/lib/utils";
import { PackageOpen } from "lucide-react";

export function EmptyState({
  icon: Icon = PackageOpen,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border bg-secondary/40 px-6 py-16 text-center", className)}>
      <div className="flex size-16 items-center justify-center rounded-full bg-brand-gradient-soft">
        <Icon className="size-8 text-primary" />
      </div>
      <div className="space-y-1">
        <h3 className="text-h5">{title}</h3>
        {description && <p className="mx-auto max-w-sm text-body-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
