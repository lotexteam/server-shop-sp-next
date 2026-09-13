"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, icon, ...props }, ref) => {
    return (
      <div className="relative w-full min-w-0">
        {icon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground [&_svg]:size-4">
            {icon}
          </span>
        )}
        <input
          type={type}
          ref={ref}
          aria-invalid={error || undefined}
          className={cn(
            "flex h-11 w-full rounded-md border border-input bg-card px-3.5 py-2 text-body-sm text-foreground shadow-sm transition-colors",
            "placeholder:text-muted-foreground/70",
            "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/30",
            "disabled:cursor-not-allowed disabled:opacity-50",
            icon && "pl-10",
            error && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);
Input.displayName = "Input";
