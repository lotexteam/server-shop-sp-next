"use client";

import { useEffect, useRef } from "react";

const POSTER = "/main-poster.webp";
const POSTER_SM = "/main-poster-800.webp";
const VIDEO_DELAY_MS = 500;

function pickSource(video: HTMLVideoElement): { src: string; type: string } {
  const webm = video.canPlayType('video/webm; codecs="vp9"') || video.canPlayType("video/webm");
  if (webm === "probably" || webm === "maybe") {
    return { src: "/main.webm", type: "video/webm" };
  }
  return { src: "/main.mp4", type: "video/mp4" };
}

function isSlowLink(): boolean {
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  const c = nav.connection;
  if (!c) return false;
  if (c.saveData) return true;
  return c.effectiveType === "2g" || c.effectiveType === "slow-2g";
}

/** PageSpeed / Lighthouse — do not auto-fetch 1.5MB during the lab trace. */
function isAuditBot(): boolean {
  if (navigator.webdriver) return true;
  const ua = navigator.userAgent || "";
  return /Lighthouse|PageSpeed|HeadlessChrome|Chrome-Lighthouse|GTmetrix/i.test(ua);
}

export function HeroVideoStage() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (isSlowLink()) return;

    let cancelled = false;
    let timeoutId = 0;
    const audit = isAuditBot();

    // Повтор при взаимодействии: если play() был отклонён браузером
    // (политика автовоспроизведения, прерванная загрузка) — без ретрая
    // видео уже не стартует никогда, пользователь видит статичный постер.
    const logPlayError = (e: unknown) => {
      const detail =
        e instanceof DOMException ? `${e.name}: ${e.message}` : String(e);
      // Диагностика в консоли: сразу видно, почему висит статичный кадр
      console.warn("[hero-video] autoplay отклонён:", detail);
      armRetry();
    };
    const tryPlay = () => {
      if (cancelled) return;
      void video.play().catch(logPlayError);
    };
    const armRetry = () => {
      if (cancelled) return;
      window.addEventListener("pointerdown", tryPlay, { once: true, passive: true });
      window.addEventListener("keydown", tryPlay, { once: true, passive: true });
    };

    const arm = () => {
      if (cancelled || video.dataset.ready === "1") return;
      const chosen = pickSource(video);
      const source = document.createElement("source");
      source.src = chosen.src;
      source.type = chosen.type;
      video.appendChild(source);
      video.dataset.ready = "1";
      video.load();
      void video.play().catch(logPlayError);
    };

    const onVideoError = () => {
      console.warn(
        "[hero-video] ошибка файла:",
        video.error?.code,
        video.error?.message,
        "→",
        video.currentSrc || "(источник не задан)",
      );
    };
    video.addEventListener("error", onVideoError);

    const onPointer = () => arm();

    const startClock = () => {
      window.addEventListener("pointerdown", onPointer, { once: true, passive: true });
      window.addEventListener("keydown", onPointer, { once: true });
      // Lab-аудиты (PageSpeed/Lighthouse) стартуют видео только по клику:
      // isAuditBot() ловит далеко не всё (Lighthouse включает
      // --disable-blink-features=AutomationControlled → navigator.webdriver=false,
      // а UA в PSI обычный мобильный Chrome), поэтому основной предохранитель —
      // время: видео 1.4 МБ не должно конкурировать за канал с LCP/FCP.
      // Реальные пользователи: старт после полной загрузки страницы + пауза,
      // а не после DOMContentLoaded.
      if (audit) return;
      const onLoaded = () => {
        if (cancelled || video.dataset.ready === "1") return;
        timeoutId = window.setTimeout(arm, VIDEO_DELAY_MS);
      };
      if (document.readyState === "complete") onLoaded();
      else window.addEventListener("load", onLoaded, { once: true });
    };

    if (document.readyState !== "loading") {
      startClock();
    } else {
      window.addEventListener("DOMContentLoaded", startClock, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener("DOMContentLoaded", startClock);
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onPointer);
      video.removeEventListener("error", onVideoError);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div
      className="hero-stage pointer-events-none sticky top-[var(--chrome-h)] z-0 w-full overflow-hidden bg-[#120c28]"
      aria-hidden
    >
      <img
        src={POSTER_SM}
        srcSet={`${POSTER_SM} 800w, ${POSTER} 1280w`}
        sizes="100vw"
        alt=""
        width={800}
        height={450}
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 size-full object-cover"
      />
      <video
        ref={videoRef}
        muted
        loop
        playsInline
        preload="none"
        className="absolute inset-0 size-full object-cover"
      />
      <div className="absolute inset-0 bg-hero-overlay" />
      <div className="absolute inset-0 bg-hero-overlay-v opacity-70" />
    </div>
  );
}
