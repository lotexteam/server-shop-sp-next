"use client";

import { useEffect, useState } from "react";

/**
 * CSS-анимация выхода без framer-motion.
 *
 * framer-motion держал элемент в DOM, пока играет `exit`; чистый CSS так не
 * умеет — React удаляет узел сразу. Хук держит элемент смонтированным ещё
 * `duration` мс после закрытия, чтобы успел проиграть класс `*-out`.
 *
 * Возвращает:
 *  - `mounted` — рендерить ли элемент вообще;
 *  - `closing` — играет ли сейчас анимация выхода (для класса).
 */
export function usePresence(open: boolean, duration = 200) {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const timer = setTimeout(() => setMounted(false), duration);
    return () => clearTimeout(timer);
  }, [open, duration]);

  return { mounted, closing: mounted && !open };
}
