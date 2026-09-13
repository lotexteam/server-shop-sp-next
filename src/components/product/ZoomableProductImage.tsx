"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { productImage } from "@/lib/placeholder";
import { cn } from "@/lib/utils";
import { Lightbox } from "@/components/product/Lightbox";

const LENS = 176; // диаметр лупы, px

type Props = {
  /** Все фото галереи (для полноэкранного просмотра) */
  images: string[];
  index: number;
  onIndex: (index: number) => void;
  alt: string;
  /** Для брендированного плейсхолдера, если фото нет/не загрузилось */
  title?: string;
  /** Классы контейнера (размер, рамка, фон) */
  className?: string;
  /** Классы картинки (по умолчанию — вписана целиком, без обрезки) */
  imgClassName?: string;
  /** Оверлеи поверх фото (например, бейдж скидки) */
  children?: ReactNode;
};

/**
 * Фото товара: точечное увеличение (лупа) при наведении на десктопе,
 * клик — полноэкранный просмотр. Фото всегда вписано целиком (object-contain)
 * и никогда не обрезается; лупа следует за курсором только в пределах фото.
 */
export function ZoomableProductImage({
  images,
  index,
  onIndex,
  alt,
  title,
  className,
  imgClassName,
  children,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const fallback = productImage(title || alt);
  const [current, setCurrent] = useState(images[index] || fallback);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [rect, setRect] = useState({ w: 0, h: 0, ox: 0, oy: 0 });
  const [zooming, setZooming] = useState(false);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const finePointer =
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  useEffect(() => {
    setCurrent(images[index] || fallback);
  }, [images, index, fallback]);

  // Прямоугольник картинки (contain-fit) внутри контейнера — для точной лупы
  const recompute = useCallback(() => {
    const el = containerRef.current;
    const img = imgRef.current;
    if (!el || !img || !img.naturalWidth) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    const scale = Math.min(cw / img.naturalWidth, ch / img.naturalHeight) || 1;
    setRect({
      w: img.naturalWidth * scale,
      h: img.naturalHeight * scale,
      ox: (cw - img.naturalWidth * scale) / 2,
      oy: (ch - img.naturalHeight * scale) / 2,
    });
  }, []);

  useEffect(() => {
    recompute();
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => recompute());
    ro.observe(el);
    return () => ro.disconnect();
  }, [recompute, current]);

  const zoom = Math.max(2, natural.w / Math.max(rect.w, 1));
  const cursorInImage =
    cursor.x >= rect.ox &&
    cursor.x <= rect.ox + rect.w &&
    cursor.y >= rect.oy &&
    cursor.y <= rect.oy + rect.h;
  const showLens = zooming && finePointer && cursorInImage && rect.w > 0;

  return (
    <div
      ref={containerRef}
      className={cn("relative cursor-zoom-in overflow-hidden", className)}
      onMouseEnter={() => setZooming(true)}
      onMouseLeave={() => setZooming(false)}
      onMouseMove={(e) => {
        const el = containerRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        setCursor({ x: e.clientX - r.left, y: e.clientY - r.top });
      }}
      onClick={() => setLightboxOpen(true)}
      title="Открыть во весь экран"
    >
      <img
        ref={imgRef}
        src={current}
        alt={alt}
        onLoad={(e) => {
          setNatural({
            w: e.currentTarget.naturalWidth,
            h: e.currentTarget.naturalHeight,
          });
          recompute();
        }}
        className={cn("size-full object-contain", imgClassName)}
      />
      {children}
      {showLens && (
        <div
          className="pointer-events-none absolute hidden rounded-full border-2 border-white bg-white shadow-[0_6px_24px_rgba(0,0,0,0.35)] md:block"
          style={{
            left: cursor.x - LENS / 2,
            top: cursor.y - LENS / 2,
            width: LENS,
            height: LENS,
            backgroundImage: `url("${current}")`,
            backgroundRepeat: "no-repeat",
            backgroundSize: `${rect.w * zoom}px ${rect.h * zoom}px`,
            backgroundPosition: `${LENS / 2 - (cursor.x - rect.ox) * zoom}px ${
              LENS / 2 - (cursor.y - rect.oy) * zoom
            }px`,
          }}
        />
      )}
      <Lightbox
        images={images.map((src) => src || fallback)}
        index={index}
        open={lightboxOpen}
        alt={alt}
        onClose={() => setLightboxOpen(false)}
        onIndex={onIndex}
      />
    </div>
  );
}
