"use client";

import Link from "next/link";
import { Home, Search, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="container-page flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
      <div className="pop-in">
        <p className="bg-brand-gradient bg-clip-text text-[8rem] font-extrabold leading-none text-transparent lg:text-[12rem]">404</p>
      </div>
      <h1 className="mt-2 text-h2">Страница не найдена</h1>
      <p className="mt-3 max-w-md text-body text-muted-foreground">Похоже, эта страница ушла на техобслуживание. Проверьте адрес или вернитесь в каталог.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild variant="gradient"><Link href="/"><Home className="size-4" /> На главную</Link></Button>
        <Button asChild variant="outline"><Link href="/catalog"><Search className="size-4" /> В каталог</Link></Button>
      </div>
    </div>
  );
}
