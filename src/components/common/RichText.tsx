"use client";

import { useMemo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from "rehype-sanitize";
import { cn } from "@/lib/utils";
import { isHtml } from "@/lib/rich-text";

/**
 * Схема санитизации: дефолтная (GitHub) плюс то, что реально пишут редактор,
 * ИИ и импорт — выравнивание/размеры картинок, colspan/rowspan таблиц,
 * раскрывающиеся блоки <details>, target/rel у внешних ссылок.
 */
const schema: SanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a ?? []), "target", "rel", "title"],
    img: [...(defaultSchema.attributes?.img ?? []), "alt", "title", "width", "height", "loading"],
    details: [...(defaultSchema.attributes?.details ?? []), "open"],
    td: [...(defaultSchema.attributes?.td ?? []), "colspan", "rowspan", "align"],
    th: [...(defaultSchema.attributes?.th ?? []), "colspan", "rowspan", "align", "scope"],
    table: [...(defaultSchema.attributes?.table ?? []), "align"],
    ol: [...(defaultSchema.attributes?.ol ?? []), "start", "type"],
  },
};

export type RichTextProps = {
  /** HTML или markdown из админки / ИИ / импорта. */
  value?: string | null;
  className?: string;
  /** Вызывается для внутренних ссылок: рендер через next/link вместо <a>. */
  renderLink?: (props: { href: string; className: string; children: ReactNode }) => ReactNode;
};

const LINK_CLASS = "text-primary underline underline-offset-2 hover:no-underline";

/**
 * HTML/markdown одним компонентом.
 *
 * Причины, почему не «сырой» `{text}`:
 * - описания приходят с HTML-разметкой (ИИ пишет `<p>`, импорт — `<br>`);
 * - markdown тоже встречается (блог, ручные описания);
 * - `rehype-raw` + `rehype-sanitize` включают HTML и защищают от XSS.
 *
 * Переносы строк в простом тексте сохраняются (как раньше `whitespace-pre-wrap`):
 * для контента без единого HTML-тега одиночный `\n` превращается в жёсткий
 * markdown-перенос.
 */
export function RichText({ value, className, renderLink }: RichTextProps) {
  const source = useMemo(() => {
    const text = (value ?? "").trim();
    if (text === "") return "";
    if (isHtml(text)) return text;

    return text.replace(/\r\n?/g, "\n").replace(/\n/g, "  \n");
  }, [value]);

  if (source === "") return null;

  return (
    <div className={cn("rich-text", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
        components={{
          a: ({ children, href, title }) => {
            const url = href ?? "";
            const external = /^https?:\/\//i.test(url);
            if (!external && url.startsWith("/") && renderLink) {
              return <>{renderLink({ href: url, className: LINK_CLASS, children })}</>;
            }

            return (
              <a
                href={url}
                className={LINK_CLASS}
                title={title}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
