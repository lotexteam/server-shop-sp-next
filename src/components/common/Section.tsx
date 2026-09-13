"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Section({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("container-page py-12 lg:py-16", className)}>{children}</section>;
}

export function SectionHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: { label: string; href: string } }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-1.5 text-body-sm font-semibold text-primary">{eyebrow}</p>}
        <h2 className="text-h3 lg:text-h2">{title}</h2>
      </div>
      {action && (
        <Link href={action.href} className="hidden shrink-0 items-center gap-1.5 text-body-sm font-semibold text-primary hover:gap-2.5 sm:flex">
          {action.label} <ArrowRight className="size-4 transition-all" />
        </Link>
      )}
    </div>
  );
}

/**
 * Scroll reveal without framer-motion: one IntersectionObserver per element,
 * the animation is a plain CSS class. Keeps the main thread free during load.
 */
export function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      el.classList.add("reveal-in");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-in");
            io.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -80px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("reveal", className)}
      style={delay ? ({ transitionDelay: `${delay}s` } as React.CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}
