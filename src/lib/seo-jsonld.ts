/**
 * Нормализация JSON-LD, который приходит из SeoDocumentBuilder.
 *
 * Бэкенд отдаёт Organization/WebSite без @id, без logo (в настройках пусто) и
 * без sameAs/contactPoint/address. Аудит 2026-11-20 фиксировал это как
 * schema-entity-id и schema-required-fields. Чинить нужно не «добавив второй
 * Organization» (получились бы две сущности без связи), а обогатив те же узлы:
 * один @id, один логотип, один адрес — и связать WebSite с Organization.
 */

export type SiteLdContext = {
  /** Канонический origin сайта (https://store-server.ru). */
  origin: string;
  /** Абсолютный URL страницы. */
  pageUrl: string;
  brand: string;
  /** Абсолютный URL логотипа (1200×630 или квадрат — что есть). */
  logoUrl: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  /** Ссылки на соцпрофили (sameAs). */
  socials?: string[];
  pageTitle?: string;
  description?: string;
  /** Дата последнего содержательного обновления страницы (W3C). */
  dateModified?: string;
};

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameType(node: Json, type: string): boolean {
  const raw = node["@type"];
  if (typeof raw === "string") return raw === type;
  if (Array.isArray(raw)) return raw.some((t) => t === type);
  return false;
}

/**
 * Обогащает узлы Organization / WebSite / Article на месте.
 * Возвращает новые объекты: исходный массив из кэша React не мутируем.
 */
export function enrichJsonLd(blocks: unknown[], ctx: SiteLdContext): unknown[] {
  const source = Array.isArray(blocks) ? blocks : [];

  const orgId = `${ctx.origin}/#organization`;
  const websiteId = `${ctx.origin}/#website`;
  const pageId = `${ctx.pageUrl}#webpage`;

  const enrichNode = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(enrichNode);
    if (!isObject(value)) return value;

    const node: Json = { ...value };

    // @graph — контейнер siteJsonLd: обогащаем вложенные узлы.
    if (Array.isArray(node["@graph"])) {
      node["@graph"] = (node["@graph"] as unknown[]).map(enrichNode);
    }

    if (sameType(node, "Organization")) {
      node["@id"] = typeof node["@id"] === "string" ? node["@id"] : orgId;
      if (!node["logo"]) {
        node["logo"] = { "@type": "ImageObject", url: ctx.logoUrl };
      }
      if (!node["image"]) node["image"] = ctx.logoUrl;
      if (ctx.address && !node["address"]) {
        node["address"] = { "@type": "PostalAddress", streetAddress: ctx.address, addressCountry: "RU" };
      }
      if (!node["contactPoint"] && (ctx.phone || ctx.email)) {
        node["contactPoint"] = [
          {
            "@type": "ContactPoint",
            contactType: "sales",
            ...(ctx.phone ? { telephone: ctx.phone } : {}),
            ...(ctx.email ? { email: ctx.email } : {}),
            areaServed: "RU",
            availableLanguage: ["Russian"],
          },
        ];
      }
      if (ctx.socials?.length && !node["sameAs"]) {
        node["sameAs"] = ctx.socials;
      }
      return node;
    }

    if (sameType(node, "WebSite")) {
      node["@id"] = typeof node["@id"] === "string" ? node["@id"] : websiteId;
      if (!node["publisher"]) node["publisher"] = { "@id": orgId };
      if (!node["inLanguage"]) node["inLanguage"] = "ru-RU";
      return node;
    }

    // Article/NewsArticle: E-E-A-T требует автора-организацию и даты.
    if (sameType(node, "Article") || sameType(node, "BlogPosting") || sameType(node, "NewsArticle")) {
      if (!node["author"]) node["author"] = { "@id": orgId };
      if (!node["publisher"]) node["publisher"] = { "@id": orgId };
      if (ctx.dateModified && !node["dateModified"]) node["dateModified"] = ctx.dateModified;
      return node;
    }

    if (sameType(node, "Product")) {
      if (!node["brand"] && ctx.brand) node["brand"] = { "@type": "Brand", name: ctx.brand };
      return node;
    }

    return node;
  };

  const enriched = source.map(enrichNode);

  // WebPage-узел: связывает страницу с сайтом и организацией и несёт дату
  // обновления (eeat-content-dates ищет dateModified/datePublished в разметке).
  const hasWebPage = enriched.some((block) => {
    if (!isObject(block)) return false;
    if (sameType(block, "WebPage")) return true;
    const graph = block["@graph"];
    return Array.isArray(graph) && graph.some((n) => isObject(n) && sameType(n, "WebPage"));
  });

  if (!hasWebPage) {
    enriched.push({
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": pageId,
      url: ctx.pageUrl,
      name: ctx.pageTitle || ctx.brand,
      ...(ctx.description ? { description: ctx.description } : {}),
      inLanguage: "ru-RU",
      isPartOf: { "@id": websiteId },
      about: { "@id": orgId },
      // Автор страницы — организация: E-E-A-T ожидает явную атрибуцию
      // (eeat-author-byline), а не только заголовок и описание.
      author: { "@id": orgId },
      publisher: { "@id": orgId },
      ...(ctx.dateModified ? { dateModified: ctx.dateModified } : {}),
    });
  }

  return enriched;
}

/** Абсолютный URL из относительного (для logo/image в JSON-LD). */
export function absoluteUrl(url: string | null | undefined, origin: string): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${origin}${url}`;
  return `${origin}/${url}`;
}
