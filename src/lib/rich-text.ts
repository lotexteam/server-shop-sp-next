/**
 * Утилиты для полей с форматированием (описания товаров/категорий).
 *
 * Контент приходит из админки/ИИ/импорта в двух видах: HTML (`<p>…</p>`) или
 * markdown. Для полноценного вывода используется `<RichText>`, а для коротких
 * сносок в карточках/меню — `stripHtml()`, чтобы теги не «протекали» в
 * line-clamp-2.
 *
 * Предпочтителен `isHtml()`, а не поиск «<» в тексте: одиночная «<» или
 * сущность `&lt;` — это ещё не разметка, и отправлять текст в HTML-ветку
 * означает показать его как есть, без оформления markdown.
 */

const ENTITY_PROBE = /&(?:#x?[0-9a-f]+|[a-z][a-z0-9]*);/i;

/** Есть ли в строке HTML-разметка (а не просто «<» в тексте). */
export function isHtml(value: string): boolean {
  return /<\/?[a-z][a-z0-9-]*(?:\s[^>]*)?>/i.test(value) || ENTITY_PROBE.test(value);
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  laquo: "«",
  raquo: "»",
  mdash: "—",
  ndash: "–",
  hellip: "…",
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith("#x")) {
      const code = Number.parseInt(lower.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (lower.startsWith("#")) {
      const code = Number.parseInt(lower.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }

    return NAMED_ENTITIES[lower] ?? match;
  });
}

/**
 * HTML/markdown → плоский текст для коротких сносок.
 *
 * Блочные теги превращаются в пробел, `<br>` — в перевод строки, поэтому
 * `«Сервер</p><p>Dell»` не склеивается в «СерверDell».
 */
export function stripHtml(value?: string | null): string {
  if (!value) return "";
  const text = value
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote|details|summary|table)>/gi, " ")
    .replace(/<[^>]*>/g, " ");
  const plain = decodeEntities(text)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return plain;
}

/**
 * Markdown → plain text упрощённо (для сниппетов): убираем разметку ссылок,
 * жирного текста, заголовков и списков, затем схлопываем пробелы.
 */
export function stripMarkdown(value?: string | null): string {
  if (!value) return "";
  const text = value
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~`>]+/g, " ")
    .replace(/^\s*[-+*]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "");

  return stripHtml(text);
}

/** HTML или markdown → плоский текст одной строкой (для title/aria). */
export function plainText(value?: string | null): string {
  if (!value) return "";

  return (isHtml(value) ? stripHtml(value) : stripMarkdown(value))
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
