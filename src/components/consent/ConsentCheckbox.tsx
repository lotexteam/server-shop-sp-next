"use client";

import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { formConsentText, privacyPolicyHref } from "@/lib/consent/consent";
import { cn } from "@/lib/utils";

type ConsentCheckboxProps = {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: boolean;
  className?: string;
};

/**
 * Чекбокс согласия на обработку ПД (блок Б ТЗ 152-ФЗ) для веб-форм.
 * Пустой по умолчанию, обязателен для отправки формы; текст берется из
 * настроек модуля (GET /consent/config), ссылка на Политику — в новом окне.
 */
export function ConsentCheckbox({ id, checked, onChange, error, className }: ConsentCheckboxProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 transition-colors",
        error ? "border-destructive bg-destructive/5" : "border-border bg-secondary/40",
        className,
      )}
      data-consent-checkbox
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
        className="mt-0.5"
        aria-invalid={error || undefined}
      />
      <label htmlFor={id} className="cursor-pointer text-caption leading-relaxed text-muted-foreground">
        {formConsentText()}{" "}
        <Link
           href={privacyPolicyHref()}
          target="_blank"
          rel="noreferrer"
          className="text-foreground underline underline-offset-2 hover:text-primary"
        >
          Политика конфиденциальности
        </Link>
        {error && <span className="mt-1 block text-destructive">Необходимо дать согласие на обработку персональных данных</span>}
      </label>
    </div>
  );
}
