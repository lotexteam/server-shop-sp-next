"use client";

import { useEffect, useState } from "react";

function viewportHeight() {
  return Math.round(window.visualViewport?.height ?? window.innerHeight);
}

function chromeHeight() {
  const stack = document.querySelector<HTMLElement>("[data-chrome='chrome']");
  if (stack) {
    return Math.round(stack.getBoundingClientRect().height);
  }
  let h = 0;
  document.querySelectorAll<HTMLElement>("[data-chrome]").forEach((node) => {
    h += Math.round(node.getBoundingClientRect().height);
  });
  return h;
}

/**
 * Exact pixel height for a first-screen block that must fill the viewport
 * under the site chrome (TopBar + Header), without overflowing up/down.
 * Uses visualViewport so mobile browser UI is accounted for.
 */
export function useViewportFillHeight(min = 320) {
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const measure = () => {
      const vh = viewportHeight();
      const chrome = chromeHeight();
      setHeight(Math.max(min, vh - chrome));
    };

    const rafMeasure = () => {
      requestAnimationFrame(measure);
    };

    rafMeasure();

    window.addEventListener("resize", rafMeasure);
    window.visualViewport?.addEventListener("resize", rafMeasure);

    const ro = new ResizeObserver(rafMeasure);
    document.querySelectorAll("[data-chrome]").forEach((n) => ro.observe(n));

    return () => {
      window.removeEventListener("resize", rafMeasure);
      window.visualViewport?.removeEventListener("resize", rafMeasure);
      ro.disconnect();
    };
  }, [min]);

  return height;
}

function chromeStackHeight() {
  const stack = document.querySelector<HTMLElement>("[data-chrome='chrome']");
  if (stack) return Math.round(stack.getBoundingClientRect().height);
  return chromeHeight();
}

/** Writes measured sticky chrome (topbar + header + nav) to `--chrome-h`. */
export function useChromeHeightVar() {
  useEffect(() => {
    const root = document.documentElement;
    let last = -1;
    let raf = 0;
    const measure = () => {
      const h = chromeStackHeight();
      if (h === last || h <= 0) return;
      last = h;
      root.style.setProperty("--chrome-h", `${h}px`);
      root.style.setProperty("--header-offset", `${h}px`);
    };
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    raf = requestAnimationFrame(measure);
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    const ro = new ResizeObserver(onResize);
    const stack = document.querySelector("[data-chrome='chrome']");
    if (stack) ro.observe(stack);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      ro.disconnect();
    };
  }, []);
}

/**
 * Sticky panel under the stuck chrome (topbar + header).
 * Returns { top, height } in px for sticky positioning.
 */
export function useStickyUnderHeader(min = 280) {
  const [size, setSize] = useState<{ top: number; height: number } | undefined>(undefined);

  useEffect(() => {
    const measure = () => {
      const headerH = chromeStackHeight() || 64;
      const vh = viewportHeight();
      setSize({ top: headerH, height: Math.max(min, vh - headerH) });
    };
    const onResize = () => requestAnimationFrame(measure);

    onResize();
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);

    const ro = new ResizeObserver(onResize);
    const stack = document.querySelector("[data-chrome='chrome']");
    if (stack) ro.observe(stack);

    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      ro.disconnect();
    };
  }, [min]);

  return size;
}
