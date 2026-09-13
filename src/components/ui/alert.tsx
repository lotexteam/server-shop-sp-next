"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Info, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const alertVariants = cva("relative flex gap-3 rounded-md border p-4 text-body-sm", {
  variants: {
    variant: {
      info: "border-primary/20 bg-primary/5 text-foreground",
      success: "border-success/25 bg-success/5 text-foreground",
      warning: "border-warning/30 bg-warning/10 text-foreground",
      error: "border-destructive/25 bg-destructive/5 text-foreground",
    },
  },
  defaultVariants: { variant: "info" },
});

const icons = { info: Info, success: CheckCircle2, warning: AlertTriangle, error: XCircle };
const tones = { info: "text-primary", success: "text-success", warning: "text-warning-foreground", error: "text-destructive" };

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  title?: string;
}

export function Alert({ className, variant = "info", title, children, ...props }: AlertProps) {
  const Icon = icons[variant!];
  return (
    <div role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      <Icon className={cn("mt-0.5 size-5 shrink-0", tones[variant!])} />
      <div className="space-y-0.5">
        {title && <p className="font-semibold text-foreground">{title}</p>}
        <div className="text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}
