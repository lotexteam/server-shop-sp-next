"use client";

import { useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type Props = {
  images: string[];
  index: number;
  open: boolean;
  alt: string;
  onClose: () => void;
  onIndex: (index: number) => void;
};

/** Полноэкранный просмотр фото: клик по фону/Esc — закрыть, стрелки — листать. */
export function Lightbox({ images, index, open, alt, onClose, onIndex }: Props) {
  const single = images.length <= 1;
  const go = (delta: number) =>
    onIndex((index + delta + images.length) % images.length);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (!single && e.key === "ArrowLeft") go(-1);
      if (!single && e.key === "ArrowRight") go(1);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, images.length, single, onClose, onIndex]);

  if (!open || images.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр фото"
      // stopPropagation: клики не должны всплывать до контейнера фото
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      {!single && (
        <>
          <button
            type="button"
            aria-label="Предыдущее фото"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20"
          >
            <ChevronLeft className="size-6" />
          </button>
          <button
            type="button"
            aria-label="Следующее фото"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20"
          >
            <ChevronRight className="size-6" />
          </button>
        </>
      )}
      <button
        type="button"
        aria-label="Закрыть"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute right-3 top-3 rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/20"
      >
        <X className="size-5" />
      </button>
      <img
        src={images[index]}
        alt={alt}
        className="max-h-[92vh] max-w-[94vw] select-none object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      {!single && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-caption text-white">
          {index + 1} / {images.length}
        </div>
      )}
    </div>
  );
}
