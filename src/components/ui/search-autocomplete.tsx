"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search as SearchIcon, X, Package, FolderOpen, ArrowRight, Loader2 } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import {
  MIN_SEARCH_CHARS,
  highlightSegments,
  loadRecentSearches,
  rememberRecentSearch,
  searchSuggestions,
  type CategoryHit,
  type SuggestionProduct,
} from "@/lib/search";
import { categoryHref } from "@/lib/api";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
  /** Called after navigation from a suggestion */
  onNavigate?: () => void;
  autoFocus?: boolean;
  categorySlug?: string;
};

/**
 * Debounce держим коротким: подсказки дешёвые (лёгкий ответ + кэш на бэке),
 * а ощущение «печатаю — сразу вижу» важнее экономии пары запросов.
 */
const DEBOUNCE_MS = 130;

function Highlighted({ text, query }: { text: string; query: string }) {
  const segments = useMemo(() => highlightSegments(text, query), [text, query]);

  return (
    <>
      {segments.map((segment, index) =>
        segment.match ? (
          <mark key={index} className="rounded-sm bg-primary/15 px-0.5 text-foreground">
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        )
      )}
    </>
  );
}

export function SearchAutocomplete({
  value,
  onChange,
  onClear,
  placeholder = "Поиск по каталогу…",
  className,
  onNavigate,
  autoFocus,
  categorySlug,
}: Props) {
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [debounced, setDebounced] = useState(value);
  const [pending, setPending] = useState(false);
  const [categoryHits, setCategoryHits] = useState<CategoryHit[]>([]);
  const [productHits, setProductHits] = useState<SuggestionProduct[]>([]);

  useEffect(() => {
    setPending(true);
    const t = window.setTimeout(() => {
      setDebounced(value);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [value]);

  useEffect(() => {
    const query = debounced.trim();
    if (query.length < MIN_SEARCH_CHARS) {
      setCategoryHits([]);
      setProductHits([]);
      setPending(false);
      return;
    }

    // Отменяем предыдущий запрос: иначе «с» из «сетевой» продолжает занимать
    // лимит и может прийти позже актуального ответа.
    const controller = new AbortController();
    setPending(true);

    void searchSuggestions(query, { products: 8, categories: 4 }, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setCategoryHits(result.categories);
        setProductHits(result.products);
        setPending(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setCategoryHits([]);
        setProductHits([]);
        setPending(false);
      });

    return () => controller.abort();
  }, [debounced]);

  // Пустое поле и фокус: подсказываем недавние запросы пользователя.
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    if (open && value.trim() === "") setRecent(loadRecentSearches());
  }, [open, value]);

  const showRecent = open && value.trim() === "" && recent.length > 0;

  /** Flat list for keyboard navigation: categories → products → "all results" */
  const flatItems = useMemo(() => {
    const items: Array<
      | { type: "category"; hit: CategoryHit }
      | { type: "product"; hit: SuggestionProduct }
      | { type: "all"; query: string }
    > = [];
    for (const hit of categoryHits) items.push({ type: "category", hit });
    for (const hit of productHits) items.push({ type: "product", hit });
    if (debounced.trim().length >= MIN_SEARCH_CHARS) {
      items.push({ type: "all", query: debounced.trim() });
    }
    return items;
  }, [categoryHits, productHits, debounced]);

  const showPanel = open && value.trim().length >= MIN_SEARCH_CHARS;
  const query = debounced.trim();

  const catalogSearchPath = useCallback((q: string) => {
    const base = categorySlug ? `/catalog/${encodeURIComponent(categorySlug)}` : "/catalog";
    return `${base}?q=${encodeURIComponent(q)}`;
  }, [categorySlug]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [debounced]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const go = useCallback(
    (path: string) => {
      setOpen(false);
      onNavigate?.();
      router.push(path);
    },
    [router, onNavigate]
  );

  const selectIndex = useCallback(
    (index: number) => {
      const item = flatItems[index];
      if (!item) return;
      if (item.type === "product") go(`/product/${item.hit.slug}`);
      else if (item.type === "category") go(categoryHref(item.hit.category.slug));
      else go(catalogSearchPath(item.query));
    },
    [flatItems, go, catalogSearchPath]
  );

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = value.trim();
    if (activeIndex >= 0 && flatItems[activeIndex]) {
      selectIndex(activeIndex);
      return;
    }
    // Уходим в каталог с запросом — запоминаем его как недавний.
    if (q) {
      rememberRecentSearch(q);
      go(catalogSearchPath(q));
    } else go("/catalog");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showPanel && e.key !== "Escape") {
      if (e.key === "ArrowDown" && value.trim()) setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(flatItems.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(-1, i - 1));
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      <form onSubmit={submit} className="relative w-full" role="search">
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 z-[1] size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="search"
          value={value}
          autoFocus={autoFocus}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined
          }
          className={cn(
            "h-11 w-full rounded-md border border-input bg-card pl-10 pr-10 text-body-sm shadow-sm transition-colors",
            "placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/30",
            "[&::-webkit-search-cancel-button]:appearance-none"
          )}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onClear?.();
              onChange("");
              setOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Очистить"
          >
            <X className="size-4" />
          </button>
        )}
      </form>

      {showRecent && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-50 overflow-hidden rounded-lg border border-border bg-popover py-2 shadow-elevated">
          <p className="px-3 py-1.5 text-caption font-semibold uppercase tracking-wide text-muted-foreground">
            Недавние запросы
          </p>
          {recent.map((query) => (
            <button
              key={query}
              type="button"
              onClick={() => {
                onChange(query);
                rememberRecentSearch(query);
                go(catalogSearchPath(query));
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-body-sm text-foreground transition-colors hover:bg-secondary/70"
            >
              <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{query}</span>
            </button>
          ))}
        </div>
      )}

      {showPanel && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-50 overflow-hidden rounded-lg border border-border bg-popover shadow-elevated"
        >
          {pending && categoryHits.length === 0 && productHits.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-6 text-body-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Ищем…
            </div>
          ) : categoryHits.length === 0 && productHits.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-body-sm font-medium text-foreground">Ничего не найдено</p>
              <p className="mt-1 text-caption text-muted-foreground">
                Попробуйте другое название, бренд или категорию
              </p>
              <button
                type="button"
                className="mt-3 text-body-sm font-semibold text-primary hover:underline"
                onClick={() => go(catalogSearchPath(value.trim()))}
              >
                Искать «{value.trim()}» в каталоге
              </button>
            </div>
          ) : (
            <div className="max-h-[min(28rem,70vh)] overflow-y-auto py-2">
              {categoryHits.length > 0 && (
                <div className="mb-1">
                  <p className="px-3 py-1.5 text-caption font-semibold uppercase tracking-wide text-muted-foreground">
                    Категории
                  </p>
                  {categoryHits.map((hit) => {
                    const idx = flatItems.findIndex(
                      (it) => it.type === "category" && it.hit.category.id === hit.category.id
                    );
                    const active = idx === activeIndex;
                    return (
                      <Link
                        key={hit.category.id}
                        id={`${listId}-opt-${idx}`}
                        role="option"
                        aria-selected={active}
                        href={categoryHref(hit.category.slug)}
                        onClick={() => {
                          setOpen(false);
                          onNavigate?.();
                        }}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 transition-colors",
                          active ? "bg-secondary" : "hover:bg-secondary/70"
                        )}
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-gradient-soft text-primary">
                          <FolderOpen className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-body-sm font-semibold text-foreground">
                            <Highlighted text={hit.category.title} query={query} />
                          </span>
                          <span className="block truncate text-caption text-muted-foreground">
                            {hit.category.count} товаров
                            {hit.category.description ? ` · ${hit.category.description}` : ""}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}

              {productHits.length > 0 && (
                <div className="mb-1">
                  <p className="px-3 py-1.5 text-caption font-semibold uppercase tracking-wide text-muted-foreground">
                    Товары
                  </p>
                  {productHits.map((hit) => {
                    const idx = flatItems.findIndex(
                      (it) => it.type === "product" && it.hit.id === hit.id
                    );
                    const active = idx === activeIndex;
                    return (
                      <Link
                        key={hit.id}
                        id={`${listId}-opt-${idx}`}
                        role="option"
                        aria-selected={active}
                        href={hit.urlPath}
                        onClick={() => {
                          setOpen(false);
                          onNavigate?.();
                        }}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 transition-colors",
                          active ? "bg-secondary" : "hover:bg-secondary/70"
                        )}
                      >
                        <span className="relative size-11 shrink-0 overflow-hidden rounded-md border border-border bg-secondary">
                          {hit.image ? (
                            <img
                              src={hit.image}
                              alt=""
                              className="size-full object-cover"
                              loading="lazy"
                            />
                          ) : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-body-sm font-semibold text-foreground">
                            <Highlighted text={hit.title} query={query} />
                          </span>
                          {(() => {
                            const bits = [
                              hit.brand?.trim() || "",
                              hit.categoryTitle?.trim() || "",
                            ].filter(Boolean);
                            if (!bits.length) return null;
                            return (
                              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-caption text-muted-foreground">
                                {bits.map((bit, i) => (
                                  <span key={`${bit}-${i}`} className="contents">
                                    {i > 0 ? <span className="text-border">·</span> : null}
                                    <span>{bit}</span>
                                  </span>
                                ))}
                              </span>
                            );
                          })()}
                        </span>
                        <span className="shrink-0 text-body-sm font-semibold text-foreground">
                          {hit.onRequest || hit.price == null
                            ? "Под заказ"
                            : formatPrice(hit.price)}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* All results footer */}
              {(() => {
                const idx = flatItems.findIndex((it) => it.type === "all");
                const active = idx === activeIndex;
                return (
                  <button
                    type="button"
                    id={`${listId}-opt-${idx}`}
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => go(catalogSearchPath(value.trim()))}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 border-t border-border px-3 py-3 text-left text-body-sm font-semibold text-primary transition-colors",
                      active ? "bg-primary/10" : "hover:bg-secondary/70"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Package className="size-4" />
                      Все результаты по «{value.trim()}»
                    </span>
                    <ArrowRight className="size-4" />
                  </button>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
