import Link from "next/link";

/**
 * Общая обёртка для статических юридических/редакционных страниц.
 * Нужна для E-E-A-T: аудит 2026-11-20 не находил условий продажи и
 * редакционной политики (eeat-terms-of-service, eeat-editorial-policy),
 * а также проверяет наличие физического адреса и контактов на странице.
 */

export type LegalSection = { title: string; paragraphs: string[]; list?: string[] };

export function LegalPage({
  title,
  lead,
  updated,
  sections,
  children,
}: {
  title: string;
  lead: string;
  updated: string;
  sections: LegalSection[];
  children?: React.ReactNode;
}) {
  return (
    <article className="container-page max-w-3xl py-10 lg:py-14">
      <nav aria-label="Хлебные крошки" className="text-caption text-muted-foreground">
        <Link href="/" className="hover:text-primary">
          Главная
        </Link>
        <span aria-hidden> / </span>
        <span className="text-foreground">{title}</span>
      </nav>
      <h1 className="mt-4 text-h1 font-bold text-foreground">{title}</h1>
      <p className="mt-3 text-body text-muted-foreground">{lead}</p>
      <p className="mt-2 text-caption text-muted-foreground">
        Обновлено:{" "}
        <time dateTime={updated}>
          {new Date(updated).toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </time>
      </p>

      <div className="mt-8 space-y-8">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-h3 font-semibold text-foreground">{section.title}</h2>
            {section.paragraphs.map((p, i) => (
              <p key={i} className="mt-3 text-body leading-relaxed text-muted-foreground">
                {p}
              </p>
            ))}
            {section.list?.length ? (
              <ul className="mt-3 list-disc space-y-2 pl-5 text-body leading-relaxed text-muted-foreground">
                {section.list.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>

      {children}
    </article>
  );
}
