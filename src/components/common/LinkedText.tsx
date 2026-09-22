"use client";

import { Fragment } from "react";
import Link from "next/link";
import type { HomeTextSegment } from "@/lib/api";

const isExternal = (href: string) => /^(https?:|mailto:|tel:)/i.test(href);

/**
 * Рендерит CMS-фрагменты текста: фрагмент со ссылкой — кликабельное слово,
 * без ссылки — обычный текст. Пустые segments → fallback (plain-строка).
 */
export function LinkedText({
  segments,
  fallback,
  linkClassName,
}: {
  segments?: HomeTextSegment[];
  fallback?: string | null;
  linkClassName?: string;
}) {
  if (!segments || segments.length === 0) {
    return <>{fallback ?? null}</>;
  }
  return (
    <>
      {segments.map((seg, i) => (
        <Fragment key={`${seg.text}-${i}`}>
          {i > 0 && " "}
          {seg.href ? (
            isExternal(seg.href) ? (
              <a
                href={seg.href}
                target={/^https?:/i.test(seg.href) ? "_blank" : undefined}
                rel="noopener noreferrer"
                className={linkClassName}
              >
                {seg.text}
              </a>
            ) : (
              <Link href={seg.href} className={linkClassName}>
                {seg.text}
              </Link>
            )
          ) : (
            <span>{seg.text}</span>
          )}
        </Fragment>
      ))}
    </>
  );
}
