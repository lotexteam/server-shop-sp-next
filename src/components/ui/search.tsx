"use client";

import * as React from "react";
import { Search as SearchIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
  containerClassName?: string;
}

export const Search = React.forwardRef<HTMLInputElement, SearchProps>(
  ({ className, containerClassName, value, onClear, placeholder = "Поиск по каталогу…", ...props }, ref) => (
    <div className={cn("relative w-full", containerClassName)}>
      <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={ref}
        type="search"
        value={value}
        placeholder={placeholder}
        className={cn(
          "h-11 w-full rounded-md border border-input bg-card pl-10 pr-10 text-body-sm shadow-sm transition-colors",
          "placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/30",
          "[&::-webkit-search-cancel-button]:appearance-none",
          className
        )}
        {...props}
      />
      {value && onClear && (
        <button type="button" onClick={onClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Очистить">
          <X className="size-4" />
        </button>
      )}
    </div>
  )
);
Search.displayName = "Search";
