"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Home, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Кастомная 404: навигация + поиск по каталогу.
 * SEO-аудит 2026-11-20 (technical-404-page) просил именно такой набор, а не
 * пустую страницу с одной ссылкой «на главную».
 */
export function NotFoundPage() {
  const router = useRouter();
  const [q, setQ] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `/catalog?q=${encodeURIComponent(query)}` : "/catalog");
  };

  return (
    <div className="container-page flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
      <div className="pop-in">
        <p className="bg-brand-gradient bg-clip-text text-[8rem] font-extrabold leading-none text-transparent lg:text-[12rem]">404</p>
      </div>
      <h1 className="mt-2 text-h2">Страница не найдена</h1>
      <p className="mt-3 max-w-md text-body text-muted-foreground">
        Похоже, эта страница ушла на техобслуживание. Проверьте адрес, найдите товар
        через поиск или вернитесь в каталог.
      </p>

      <form onSubmit={submit} role="search" method="post" className="mt-8 flex w-full max-w-md items-center gap-2" aria-label="Поиск по каталогу">
        <label htmlFor="notfound-search" className="sr-only">
          Поиск по каталогу
        </label>
        <Input
          id="notfound-search"
          name="q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Например, HPE ProLiant DL360"
          autoComplete="off"
          className="h-11"
        />
        <Button type="submit" variant="gradient" className="h-11 shrink-0">
          <Search className="size-4" aria-hidden /> Найти
        </Button>
      </form>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button asChild variant="gradient"><Link href="/"><Home className="size-4" aria-hidden /> На главную</Link></Button>
        <Button asChild variant="outline"><Link href="/catalog"><Search className="size-4" aria-hidden /> В каталог</Link></Button>
        <Button asChild variant="outline"><Link href="/contacts">Контакты</Link></Button>
      </div>
    </div>
  );
}
