"use client";

import { formatPrice } from "@/lib/utils";
import { useContacts } from "@/hooks/useContacts";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useHomeContent } from "@/hooks/useHomeContent";

export type PrintRow = {
  slot: string;
  name: string;
  unitPrice: number | null;
  qty: number | null;
  sum: number | null;
};

type Props = {
  platformName: string;
  rows: PrintRow[];
  qty: number;
  unitTotal: number;
  warrantyName?: string | null;
  warrantySum?: number;
};

export function ConfigPrintSheet({
  platformName,
  rows,
  qty,
  unitTotal,
  warrantyName,
  warrantySum = 0,
}: Props) {
  const { contacts } = useContacts();
  const { site } = useSiteSettings();
  const { content: home } = useHomeContent();
  const logoUrl = home?.logoUrl || null;
  const org = contacts?.organization;
  const companyName =
    org?.legalName || site?.brand || site?.title || "";
  const address = org?.legalAddress || contacts?.address || "";
  // Все номера из CMS (Настройки → Контакты)
  const phoneList = contacts?.phones?.length
    ? contacts.phones
    : [contacts?.phone].filter((p): p is string => Boolean(p));
  const phones = phoneList.join(", ");
  const email = contacts?.email || "";
  const workHours = contacts?.workHours || "";
  const now = new Date();
  const date = now.toLocaleDateString("ru-RU");
  const time = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const grand = unitTotal * qty;
  const vatLabel = site?.vatTotalLabel || "Итоговая стоимость (НДС 5% включён)";
  const footer =
    site?.pdfFooter ||
    (site?.title ? `Сформировано на сайте ${site.title}` : "Сформировано на сайте");

  const money = (n: number | null) => (n == null ? "—" : formatPrice(n));

  return (
    <div id="config-print-sheet" className="config-print-sheet">
      <table className="w-full border-collapse">
        <tbody>
          <tr>
            <td className="w-[48%] align-top text-[11px] leading-snug">
              <strong className="text-[12px]">{companyName}</strong>
              {address ? <><br />{address}</> : null}
              {phones ? <><br />Тел.: {phones}</> : null}
              {email ? <><br />E-mail: {email}</> : null}
              {workHours ? <><br />Режим работы: {workHours}</> : null}
            </td>
            <td className="w-[4%]" />
            <td className="w-[48%] align-top text-right text-[11px] leading-snug">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={companyName || "logo"}
                  className="ml-auto max-h-14 max-w-[180px] object-contain"
                />
              ) : (
                <>
                  <strong className="text-[12px]">{companyName}</strong>
                  <br />
                  {address}
                  {address ? <br /> : null}
                  {phones ? <>Тел.: {phones}<br /></> : null}
                  {email ? <>E-mail: {email}<br /></> : null}
                  {workHours ? <>Режим работы: {workHours}<br /></> : null}
                </>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <h1 className="mt-8 text-center text-[15px] font-bold uppercase">
        Конфигуратор {platformName}
      </h1>
      <p className="mt-1 text-right text-[11px]">
        Дата: {date}
        <br />
        {time}
      </p>

      <table className="mt-4 w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th className="border border-[#454545] bg-[#efefef] px-2 py-1.5 text-left font-bold text-black">
              Комплектующие
            </th>
            <th className="border border-[#454545] bg-[#efefef] px-2 py-1.5 text-left font-bold text-black">
              Модель
            </th>
            <th className="border border-[#454545] bg-[#efefef] px-2 py-1.5 text-center font-bold text-black">
              Цена
            </th>
            <th className="border border-[#454545] bg-[#efefef] px-2 py-1.5 text-center font-bold text-black">
              Кол-во
            </th>
            <th className="border border-[#454545] bg-[#efefef] px-2 py-1.5 text-center font-bold text-black">
              Сумма
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.slot}-${i}`}>
              <td className="border border-[#454545] px-2 py-1">{r.slot}</td>
              <td className="border border-[#454545] px-2 py-1">{r.name || "—"}</td>
              <td className="border border-[#454545] px-2 py-1 text-center">{money(r.unitPrice)}</td>
              <td className="border border-[#454545] px-2 py-1 text-center">
                {r.qty == null ? "—" : r.qty}
              </td>
              <td className="border border-[#454545] px-2 py-1 text-center">{money(r.sum)}</td>
            </tr>
          ))}
          {warrantyName ? (
            <tr>
              <td className="border border-[#454545] px-2 py-1">Гарантия</td>
              <td className="border border-[#454545] px-2 py-1">{warrantyName}</td>
              <td className="border border-[#454545] px-2 py-1 text-center"> </td>
              <td className="border border-[#454545] px-2 py-1 text-center"> </td>
              <td className="border border-[#454545] px-2 py-1 text-center">
                {warrantySum ? formatPrice(warrantySum) : "вкл."}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div className="mt-6 text-right text-[12px] leading-relaxed">
        Стоимость выбранной конфигурации: <strong>{formatPrice(unitTotal)}</strong>
        <br />
        Количество: <strong>{qty}</strong>
        <br />
        {vatLabel}: <strong>{formatPrice(grand)}</strong>
      </div>
      <p className="mt-10 text-center text-[10px] text-muted-foreground">{footer}</p>
    </div>
  );
}
