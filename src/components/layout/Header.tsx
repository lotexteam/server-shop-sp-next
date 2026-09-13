"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { Heart, User, Menu, ChevronDown, GitCompare, Phone, Mail, Clock } from "lucide-react";
import { SearchAutocomplete } from "../ui/search-autocomplete";
import { Button } from "../ui/button";
import { Drawer, DrawerContent, DrawerTrigger, DrawerClose } from "../ui/drawer";
import { MegaMenu } from "./MegaMenu";
import { CartDrawer } from "./CartDrawer";
import { useShop } from "@/store/shop";
import { useCategories } from "@/hooks/useCategories";
import { useContacts } from "@/hooks/useContacts";
import { useMenu } from "@/hooks/useMenu";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { cn } from "@/lib/utils";
import { categoryHref } from "@/lib/api";
/* Fallback when cms.site.logo_url is empty.
 * Next/Turbopack: SVG-импорт отдаёт объект, а не URL (в отличие от Vite) —
 * файл лежит в public/ и адресуется строкой. */
const headerLogo = "/header_logo.svg";

const HOVER_CLOSE_MS = 180;

/** Пункт навигации шапки */
type HeaderNavItem = { id: string; label: string; href: string };

/** Узел дерева категорий для мобильного меню */
type CatNode = { id: string; slug: string; title: string; children?: CatNode[] };

function branchHasSlug(node: CatNode, slug: string): boolean {
  if (!slug) return false;
  if (node.slug === slug) return true;
  return (node.children ?? []).some((ch) => branchHasSlug(ch, slug));
}

/** Раскрывающаяся ветвь категорий; ветка с активной категорией раскрыта сразу */
function DrawerCategoryBranch({
  node,
  depth = 0,
  activeSlug = "",
}: {
  node: CatNode;
  depth?: number;
  activeSlug?: string;
}) {
  const [open, setOpen] = useState(() => branchHasSlug(node, activeSlug));
  const kids = node.children ?? [];
  return (
    <div>
      <div className="flex items-center">
        <DrawerClose asChild>
          <Link
             href={categoryHref(node.slug)}
            className={cn(
              "min-w-0 flex-1 truncate rounded-md px-3 py-2.5 text-body-sm hover:bg-secondary hover:text-primary",
              depth > 0 && "ml-2 border-l border-border pl-2 text-muted-foreground",
            )}
          >
            {node.title}
          </Link>
        </DrawerClose>
        {kids.length > 0 && (
          <button
            type="button"
            className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-primary"
            aria-expanded={open}
            aria-label={open ? "Свернуть подкатегории" : "Показать подкатегории"}
            onClick={() => setOpen((v) => !v)}
          >
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
          </button>
        )}
      </div>
      {open && kids.length > 0 && (
        <div className={cn(kids.length > 14 && "max-h-56 overflow-y-auto overscroll-contain")}>
          {kids.map((ch) => (
            <DrawerCategoryBranch key={ch.id} node={ch} depth={depth + 1} activeSlug={activeSlug} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Header() {
  const [megaOpen, setMegaOpen] = useState(false);
  /** Click keeps menu open until next click / outside / navigate */
  const [megaPinned, setMegaPinned] = useState(false);
  const [q, setQ] = useState("");
  const { favorites, compare } = useShop();
  const { categories } = useCategories();
  const { contacts } = useContacts();
  const { items: menuItems, loading: menuLoading } = useMenu("header");
  const { site } = useSiteSettings();
  const brand = site?.brand?.trim() || site?.title?.trim() || "";
  const logoSrc = site?.logoUrl || headerLogo;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const megaRootRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Навигация — из CMS GET /menus/header. Пока меню пустое — fallback:
  // все корневые категории + старые ссылки (меняется в админке, Menus → header).
  const navItems: HeaderNavItem[] = menuItems.length
    ? menuItems.map((i) => ({ id: i.id, label: i.label, href: i.href }))
    : menuLoading
      ? []
      : [
          ...categories.map((c) => ({
            id: `fb-${c.id}`,
            label: c.title,
            href: categoryHref(c.slug),
          })),
          { id: "fb-services", label: "Услуги", href: "/services" },
          { id: "fb-contacts", label: "Контакты", href: "/contacts" },
        ];

  // Активность пункта: путь должен совпасть, а параметры из href (например
  // легаси category=slug у категорий) — с текущими. Иначе все категории
  // каталога «загораются» одновременно.
  const isItemActive = (href: string) => {
    const [path, query = ""] = href.split("?");
    if (pathname !== path) return false;
    const params = new URLSearchParams(query);
    for (const [key, value] of params) {
      if ((searchParams.get(key) || "") !== value) return false;
    }
    return true;
  };

  // ── Мобильное меню: категории деревом, без дублей с пунктами меню ───────
  // Категория может быть в пути (ЧПУ /catalog/{slug}) или в легаси query.
  const pathCategorySlug = pathname.match(/^\/catalog\/([^/]+)/)?.[1] ?? "";
  const activeCategorySlug = pathCategorySlug || searchParams.get("category") || "";

  // Пункт меню ведёт в категорию каталога? (ЧПУ /catalog/{slug} или легаси
  // query/categorySlug) — в дереве «Каталог» он лишний.
  const isCategoryLink = (href: string, categorySlug?: string, categoryId?: string) =>
    Boolean(
      categorySlug ||
        categoryId ||
        /^\/catalog\/[^/]+\/?$/.test(href.split("?")[0]) ||
        new URLSearchParams(href.split("?")[1] ?? "").has("category"),
    );

  // Информационные страницы: пункты CMS-меню, не ведущие в категории
  const infoItems: HeaderNavItem[] = menuItems.length
    ? menuItems
        .filter((i) => !isCategoryLink(i.href, i.categorySlug, i.categoryId))
        .map((i) => ({ id: i.id, label: i.label, href: i.href }))
    : menuLoading
      ? []
      : [
          { id: "fb-services", label: "Услуги", href: "/services" },
          { id: "fb-contacts", label: "Контакты", href: "/contacts" },
        ];

  // Телефоны из CMS (Настройки → Контакты): весь список, первый — основной
  const phones = (contacts?.phones?.length
    ? contacts.phones
    : contacts?.phone
      ? [contacts.phone]
      : []
  ).map((p) => ({ label: p, href: `tel:${p.replace(/\D+/g, "")}` }));

  const clearCloseTimer = () => {
    if (closeTimerRef.current != null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const openMega = useCallback(() => {
    clearCloseTimer();
    setMegaOpen(true);
  }, []);

  const closeMega = useCallback(() => {
    clearCloseTimer();
    setMegaOpen(false);
    setMegaPinned(false);
  }, []);

  const scheduleClose = useCallback(() => {
    if (megaPinned) return;
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setMegaOpen(false);
      closeTimerRef.current = null;
    }, HOVER_CLOSE_MS);
  }, [megaPinned]);

  const onCatalogClick = () => {
    clearCloseTimer();
    if (megaPinned) {
      // Second click — unpin and close
      setMegaPinned(false);
      setMegaOpen(false);
    } else {
      // Pin open until next explicit close
      setMegaPinned(true);
      setMegaOpen(true);
    }
  };

  // Outside click closes when open (hover or pinned)
  useEffect(() => {
    if (!megaOpen) return;

    const onPointerDown = (e: MouseEvent | PointerEvent) => {
      const root = megaRootRef.current;
      if (!root) return;
      if (e.target instanceof Node && !root.contains(e.target)) {
        closeMega();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMega();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [megaOpen, closeMega]);

  useEffect(() => () => clearCloseTimer(), []);

  return (
    <header data-chrome="header" className="border-b border-border">
      <div className="container-page flex h-[var(--header-row-h)] items-center gap-3 sm:gap-4">
        {/* Mobile menu */}
        <Drawer>
          <DrawerTrigger asChild>
            <button className="flex size-11 items-center justify-center rounded-md text-foreground hover:bg-secondary lg:hidden" aria-label="Меню">
              <Menu className="size-5" />
            </button>
          </DrawerTrigger>
          <DrawerContent side="left" className="flex max-h-dvh flex-col p-0">
            <div className="flex items-center justify-between border-b border-border p-5">
              <span className="text-h5 font-bold">Меню</span>
            </div>
            <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
              <span className="px-3 pb-1 pt-1 text-caption font-semibold uppercase text-muted-foreground">
                Каталог
              </span>
              {(categories as CatNode[]).map((c) => (
                <DrawerCategoryBranch key={c.id} node={c} activeSlug={activeCategorySlug} />
              ))}

              {infoItems.length > 0 && (
                <>
                  <div className="my-2 h-px bg-border" />
                  <span className="px-3 pb-1 text-caption font-semibold uppercase text-muted-foreground">
                    Информация
                  </span>
                  {infoItems.map((n) => (
                    <DrawerClose asChild key={n.id}>
                      <Link
                         href={n.href}
                        className="rounded-md px-3 py-2.5 text-body font-medium hover:bg-secondary hover:text-primary"
                      >
                        {n.label}
                      </Link>
                    </DrawerClose>
                  ))}
                </>
              )}
            </nav>

            {/* Сравнение и избранное — на мобильных их нет в шапке */}
            <div className="grid grid-cols-2 gap-2 border-t border-border p-3">
              <DrawerClose asChild>
                <Link
                   href="/account/compare"
                  className="flex items-center gap-2 rounded-md px-3 py-2.5 text-body-sm hover:bg-secondary"
                >
                  <GitCompare className="size-4 text-primary" />
                  Сравнение
                  {compare.length > 0 && (
                    <span className="text-caption text-muted-foreground">({compare.length})</span>
                  )}
                </Link>
              </DrawerClose>
              <DrawerClose asChild>
                <Link
                   href="/account/favorites"
                  className="flex items-center gap-2 rounded-md px-3 py-2.5 text-body-sm hover:bg-secondary"
                >
                  <Heart className="size-4 text-primary" />
                  Избранное
                  {favorites.length > 0 && (
                    <span className="text-caption text-muted-foreground">({favorites.length})</span>
                  )}
                </Link>
              </DrawerClose>
            </div>

            {/* Контакты из CMS (Настройки → Контакты) */}
            {(phones.length > 0 || contacts?.email || contacts?.workHours) && (
              <div className="space-y-1.5 border-t border-border p-3">
                {phones.map((p) => (
                  <a
                    key={p.href}
                    href={p.href}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-body-sm font-medium hover:bg-secondary hover:text-primary"
                  >
                    <Phone className="size-4 shrink-0 text-primary" />
                    {p.label}
                  </a>
                ))}
                {contacts?.email && (
                  <a
                    href={`mailto:${contacts.email}`}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-body-sm text-muted-foreground hover:bg-secondary hover:text-primary"
                  >
                    <Mail className="size-4 shrink-0 text-primary" />
                    {contacts.email}
                  </a>
                )}
                {contacts?.workHours && (
                  <span className="flex items-center gap-2 px-3 py-1 text-caption text-muted-foreground">
                    <Clock className="size-4 shrink-0 text-primary" />
                    {contacts.workHours}
                  </span>
                )}
              </div>
            )}
          </DrawerContent>
        </Drawer>

        <Link href="/" className="flex shrink-0 items-center gap-2">
          <img
            src={logoSrc}
            alt={brand || "logo"}
            className={
              site?.logoUrl
                ? "h-7 max-w-[7.5rem] object-contain sm:h-8 sm:max-w-[9rem] lg:h-9 lg:max-w-[11rem]"
                : "size-7 object-contain sm:size-8 lg:size-9"
            }
          />
          {brand ? (
            <span className="text-h5 font-bold lg:text-h4">{brand}</span>
          ) : null}
        </Link>

        {/* Catalog + search */}
        <div className="relative hidden flex-1 items-center gap-3 lg:flex">
          <div
            ref={megaRootRef}
            className="relative"
            onMouseEnter={openMega}
            onMouseLeave={scheduleClose}
          >
            <Button
              type="button"
              variant="secondary"
              className={cn("gap-1.5", megaOpen && "bg-muted text-primary")}
              aria-expanded={megaOpen}
              aria-haspopup="true"
              onClick={onCatalogClick}
            >
              <Menu className="size-4" />
              Каталог
              <ChevronDown className={cn("size-4 transition-transform duration-200", megaOpen && "rotate-180")} />
            </Button>

            {/*
              Mega menu is a sibling of the button inside the hover root.
              Padding-top (not margin) bridges the gap so the pointer never
              leaves the hit-area when moving from button → panel.
            */}
            <AnimatePresence>
              {megaOpen && (
                <MegaMenu
                  onNavigate={closeMega}
                  pinned={megaPinned}
                />
              )}
            </AnimatePresence>
          </div>

          <div className="min-w-0 flex-1">
            <SearchAutocomplete
              value={q}
              onChange={setQ}
              onClear={() => setQ("")}
              onNavigate={closeMega}
            />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1 lg:gap-2">
          <Link
             href="/account/compare"
            className="relative hidden size-11 items-center justify-center rounded-md text-foreground hover:bg-secondary hover:text-primary sm:flex"
            aria-label="Сравнение"
          >
            <GitCompare className="size-5" />
            {compare.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                {compare.length}
              </span>
            )}
          </Link>
          <Link
             href="/account/favorites"
            className="relative hidden size-11 items-center justify-center rounded-md text-foreground hover:bg-secondary hover:text-primary sm:flex"
            aria-label="Избранное"
          >
            <Heart className="size-5" />
            {favorites.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
                {favorites.length}
              </span>
            )}
          </Link>
          <CartDrawer />
          <Link
             href="/account"
            className="flex size-11 items-center justify-center rounded-md text-foreground hover:bg-secondary hover:text-primary"
            aria-label="Профиль"
          >
            <User className="size-5" />
          </Link>
        </div>
      </div>

      {/* Mobile search — visibility/height from CSS vars + breakpoints */}
      <div className="header-search border-t border-border px-4">
        <SearchAutocomplete
          value={q}
          onChange={setQ}
          onClear={() => setQ("")}
          onNavigate={closeMega}
        />
      </div>

      {/* Secondary nav — CMS GET /menus/header (fallback: корневые категории).
          Height is reserved from --nav-h on first paint so late menu data
          cannot shift the page. */}
      <nav className="header-nav border-t border-border">
        <div className={"container-page flex h-[var(--nav-h)] items-center gap-6 text-body-sm" + (navItems.length === 0 ? " invisible" : "")}>
          {navItems.map((n) => {
            const active = isItemActive(n.href);
            return (
              <Link
                key={n.id}
                 href={n.href}
                aria-current={active ? "page" : undefined}
                className={`font-medium transition-colors hover:text-primary ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                {n.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
