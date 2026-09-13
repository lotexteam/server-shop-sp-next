"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
  useMotionValueEvent,
} from "framer-motion";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Check,
  type LucideIcon,
} from "lucide-react";
import { getIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { useStickyUnderHeader } from "@/hooks/useViewportFill";
import { useHomeContent } from "@/hooks/useHomeContent";
import type { HomeWhySlide } from "@/lib/api";

type StorySlide = {
  id: string;
  eyebrow: string;
  title: string;
  lead: string;
  points: { icon: LucideIcon; title: string; desc: string }[];
  accent: "primary" | "accent" | "success";
};

// Пустой CMS-слот скрывает секцию: фолбэк-слайдов нет, истина только в GET /settings/home.
const FALLBACK_SLIDES: StorySlide[] = [];

function resolveIcon(name: string): LucideIcon {
  return getIcon(name);
}

function mapApiSlides(api: HomeWhySlide[]): StorySlide[] {
  return api.map((s) => ({
    id: s.id,
    eyebrow: s.eyebrow,
    title: s.title,
    lead: s.lead,
    accent: s.accent,
    points: s.points.map((p) => ({
      icon: resolveIcon(p.icon),
      title: p.title,
      desc: p.desc,
    })),
  }));
}

const accentStyles = {
  primary: {
    badge: "bg-[#4A22CE]/35 text-[#ddd6fe] ring-1 ring-[#c4b5fd]/45",
    iconWrap: "bg-[#4A22CE]/40 ring-1 ring-[#c4b5fd]/50",
    icon: "text-[#e9e5ff]",
    cardBorder: "border-white/20 hover:border-[#c4b5fd]/50",
    cardBg: "bg-white/10 hover:bg-white/[0.14]",
  },
  accent: {
    badge: "bg-[#F55688]/30 text-[#ffd0e0] ring-1 ring-[#fda4c8]/45",
    iconWrap: "bg-[#F55688]/35 ring-1 ring-[#fda4c8]/50",
    icon: "text-[#ffe4ee]",
    cardBorder: "border-white/20 hover:border-[#fda4c8]/50",
    cardBg: "bg-white/10 hover:bg-white/[0.14]",
  },
  success: {
    badge: "bg-emerald-500/30 text-emerald-100 ring-1 ring-emerald-300/45",
    iconWrap: "bg-emerald-500/35 ring-1 ring-emerald-300/50",
    icon: "text-emerald-50",
    cardBorder: "border-white/20 hover:border-emerald-300/45",
    cardBg: "bg-white/10 hover:bg-white/[0.14]",
  },
} as const;

const slideVariants = {
  enter: (dir: number) => ({ x: dir * 56, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -56, opacity: 0 }),
};

function useIsLg() {
  const [isLg, setIsLg] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsLg(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isLg;
}

function jumpWindowTo(top: number) {
  const html = document.documentElement;
  const prev = html.style.scrollBehavior;
  html.style.scrollBehavior = "auto";
  window.scrollTo({ top, left: 0, behavior: "auto" });
  requestAnimationFrame(() => {
    html.style.scrollBehavior = prev;
  });
}

export function WhyStorySection() {
  const { content, loading } = useHomeContent();
  const slides = useMemo(() => {
    const fromApi = content?.whyStory?.slides?.length
      ? mapApiSlides(content.whyStory.slides)
      : null;
    return fromApi && fromApi.length > 0 ? fromApi : FALLBACK_SLIDES;
  }, [content]);

  const isLg = useIsLg();
  const isLgRef = useRef(isLg);
  isLgRef.current = isLg;

  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [dir, setDir] = useState(1);
  const sticky = useStickyUnderHeader();
  const jumpingRef = useRef(false);
  const jumpTimerRef = useRef<number>(0);
  const swipeRef = useRef<{ x: number; y: number; locked?: "x" | "y" } | null>(null);

  const slideCount = slides.length;
  const activeRef = useRef(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (!isLgRef.current || jumpingRef.current || slideCount < 1) return;
    const idx = Math.min(slideCount - 1, Math.max(0, Math.floor(v * slideCount + 0.001)));
    setActive((prev) => (prev === idx ? prev : idx));
  });

  const progressWidth = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  const panelHeight = sticky?.height;
  const panelTop = sticky?.top ?? 64;
  const trackHeight = isLg && panelHeight != null ? panelHeight * slideCount : undefined;

  const goToSlide = useCallback(
    (index: number) => {
      if (slideCount < 1) return;
      const next = Math.min(slideCount - 1, Math.max(0, index));
      const prev = activeRef.current;
      if (next === prev) return;
      setDir(next > prev ? 1 : -1);
      setActive(next);
      activeRef.current = next;

      if (!isLgRef.current) return;

      const el = containerRef.current;
      if (!el) return;
      jumpingRef.current = true;
      window.clearTimeout(jumpTimerRef.current);
      const rect = el.getBoundingClientRect();
      const top = window.scrollY + rect.top;
      // Слайд i занимает v ∈ [i/N, (i+1)/N) пробега скролла; полный пробег =
      // высота трека минус высота панели (диапазон, где баннер ещё прилип).
      // Берём центр сегмента — иначе последний слайд уводит страницу за
      // диапазон и баннер уезжает вверх, не давая прочитать текст.
      const track = el.offsetHeight;
      const segment = track / slideCount;
      jumpWindowTo(top + ((index + 0.5) / slideCount) * (track - segment));
      const clear = () => {
        jumpingRef.current = false;
        window.removeEventListener("scrollend", clear);
      };
      window.addEventListener("scrollend", clear, { once: true });
      jumpTimerRef.current = window.setTimeout(clear, 400);
    },
    [slideCount],
  );

  useEffect(() => () => window.clearTimeout(jumpTimerRef.current), []);

  activeRef.current = Math.min(active, slideCount - 1);

  const goPrev = () => goToSlide(activeRef.current - 1);
  const goNext = () => goToSlide(activeRef.current + 1);

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (isLg || e.touches.length !== 1) return;
    swipeRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    const s = swipeRef.current;
    if (!s || s.locked || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - s.x;
    const dy = e.touches[0].clientY - s.y;
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    s.locked = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
  };
  const onTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    const s = swipeRef.current;
    swipeRef.current = null;
    if (!s || s.locked !== "x") return;
    const x = e.changedTouches[0]?.clientX ?? s.x;
    const dx = x - s.x;
    if (dx < -40) goNext();
    else if (dx > 40) goPrev();
  };

  if (loading && !content) {
    return (
      <section className="relative isolate flex h-[50vh] items-center justify-center text-white/70">
        Загрузка…
      </section>
    );
  }

  if (!slides.length) return null;

  const safeActive = Math.min(active, slides.length - 1);
  const slide = slides[safeActive];
  const tone = accentStyles[slide.accent];
  const canPrev = safeActive > 0;
  const canNext = safeActive < slides.length - 1;
  const carouselProgress = `${((safeActive + 1) / slides.length) * 100}%`;

  return (
    <section
      ref={containerRef}
      className="relative isolate"
      style={
        isLg
          ? {
              height: trackHeight != null ? trackHeight : `${slides.length * 100}vh`,
            }
          : undefined
      }
      aria-label="Почему мы"
      aria-roledescription={isLg ? undefined : "carousel"}
    >
      <div
        className={cn(
          "flex flex-col overflow-hidden text-white",
          isLg ? "sticky" : "relative",
        )}
        style={
          isLg
            ? {
                top: panelTop,
                height: panelHeight != null ? panelHeight : "calc(100dvh - var(--chrome-h))",
                maxHeight: panelHeight != null ? panelHeight : undefined,
              }
            : undefined
        }
      >
        <div className="absolute inset-x-0 top-0 z-20 h-1 bg-white/15">
          {isLg ? (
            <motion.div className="h-full bg-brand-gradient" style={{ width: progressWidth }} />
          ) : (
            <div
              className="h-full bg-brand-gradient transition-[width] duration-300 ease-out"
              style={{ width: carouselProgress }}
            />
          )}
        </div>

        <button
          type="button"
          onClick={goPrev}
          disabled={!canPrev}
          aria-label="Предыдущий слайд"
          className={cn(
            "absolute left-2 top-1/2 z-30 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/25 text-white shadow-lg backdrop-blur-md transition-all lg:flex lg:left-6 lg:size-12",
            canPrev
              ? "hover:border-white/50 hover:bg-white/15 hover:scale-105 active:scale-95"
              : "cursor-not-allowed opacity-30",
          )}
        >
          <ChevronLeft className="size-6" strokeWidth={2.25} />
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={!canNext}
          aria-label="Следующий слайд"
          className={cn(
            "absolute right-2 top-1/2 z-30 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/25 text-white shadow-lg backdrop-blur-md transition-all lg:flex lg:right-6 lg:size-12",
            canNext
              ? "hover:border-white/50 hover:bg-white/15 hover:scale-105 active:scale-95"
              : "cursor-not-allowed opacity-30",
          )}
        >
          <ChevronRight className="size-6" strokeWidth={2.25} />
        </button>

        <div
          className={cn(
            "container-page relative z-10 flex min-h-0 flex-1 flex-col py-6 sm:py-8",
            isLg ? "overflow-hidden px-14 lg:px-16 lg:py-12" : "overflow-hidden px-4",
          )}
        >
          <div
            className={cn(
              "mb-5 flex items-center gap-2 lg:mb-10",
              isLg ? "flex-wrap justify-start" : "justify-center overflow-x-auto",
            )}
          >
            {isLg
              ? slides.map((s, i) => {
                  const isOn = i === safeActive;
                  const isDone = i < safeActive;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => goToSlide(i)}
                      className={cn(
                        "flex items-center gap-2 rounded-full border px-3 py-1.5 text-caption font-semibold backdrop-blur-sm transition-all duration-300",
                        isOn
                          ? "border-white/55 bg-white/20 text-white shadow-[0_0_0_3px_rgba(255,255,255,0.08)]"
                          : isDone
                            ? "border-white/30 bg-white/10 text-white/90 hover:bg-white/15"
                            : "border-white/20 bg-white/5 text-white/70 hover:border-white/35 hover:text-white",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
                          isOn || isDone
                            ? "bg-brand-gradient text-white"
                            : "bg-white/15 text-white/80",
                        )}
                      >
                        {isDone ? <CheckCircle2 className="size-3.5" /> : i + 1}
                      </span>
                      {s.eyebrow}
                    </button>
                  );
                })
              : slides.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => goToSlide(i)}
                    aria-label={s.eyebrow}
                    aria-current={i === safeActive ? "true" : undefined}
                    className={cn(
                      "h-2 rounded-full transition-all",
                      i === safeActive ? "w-6 bg-white" : "w-2 bg-white/35",
                    )}
                  />
                ))}
          </div>

          <div
            className="relative grid min-h-0 flex-1 overflow-hidden"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={() => {
              swipeRef.current = null;
            }}
            style={{ touchAction: "pan-y" }}
          >
            <AnimatePresence initial={false} custom={dir}>
              <motion.div
                key={slide.id}
                custom={dir}
                variants={isLg ? undefined : slideVariants}
                initial={isLg ? { opacity: 0, y: 16 } : "enter"}
                animate={isLg ? { opacity: 1, y: 0 } : "center"}
                exit={isLg ? { opacity: 0, y: -12 } : "exit"}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="col-start-1 row-start-1 grid min-h-0 w-full items-center gap-6 lg:grid-cols-12 lg:gap-12"
              >
                <div className="lg:col-span-5">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-3 py-1 text-caption font-semibold backdrop-blur-sm",
                      tone.badge,
                    )}
                  >
                    {slide.eyebrow}
                  </span>
                  <h2 className="mt-3 text-h3 text-white drop-shadow-sm sm:mt-4 sm:text-h2 lg:text-h1">
                    {slide.title}
                  </h2>
                  <p className="mt-3 max-w-md text-body-sm text-white/90 sm:mt-4 sm:text-body-lg">
                    {slide.lead}
                  </p>
                </div>

                <ul className="grid gap-3 lg:col-span-7">
                  {slide.points.map((p) => {
                    const Icon = p.icon;
                    return (
                      <li
                        key={p.title}
                        className={cn(
                          "flex gap-3 rounded-xl border p-4 backdrop-blur-md sm:gap-4 sm:p-5",
                          tone.cardBorder,
                          tone.cardBg,
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-10 shrink-0 items-center justify-center rounded-lg sm:size-12",
                            tone.iconWrap,
                          )}
                        >
                          <Icon className={cn("size-5 sm:size-6", tone.icon)} strokeWidth={2.1} />
                        </span>
                        <div className="min-w-0">
                          <h3 className="text-h6 text-white">{p.title}</h3>
                          <p className="mt-1 text-caption text-white/85 sm:text-body-sm">{p.desc}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-6 flex items-center justify-center gap-3 lg:mt-8">
            <button
              type="button"
              onClick={goPrev}
              disabled={!canPrev}
              className={cn(
                "flex size-10 items-center justify-center rounded-full border border-white/25 text-white transition-colors lg:hidden",
                canPrev ? "active:bg-white/15" : "opacity-30",
              )}
              aria-label="Назад"
            >
              <ChevronLeft className="size-5" />
            </button>
            <p className="text-caption font-medium text-white/70">
              {safeActive + 1} / {slides.length}
            </p>
            <button
              type="button"
              onClick={goNext}
              disabled={!canNext}
              className={cn(
                "flex size-10 items-center justify-center rounded-full border border-white/25 text-white transition-colors lg:hidden",
                canNext ? "active:bg-white/15" : "opacity-30",
              )}
              aria-label="Вперёд"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
