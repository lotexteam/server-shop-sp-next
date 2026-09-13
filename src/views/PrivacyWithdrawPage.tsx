"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  confirmPdWithdrawal,
  requestPdWithdrawal,
  StorefrontApiError,
} from "@/lib/api";
import { logConsent } from "@/lib/consent/consent";

/**
 * «Право на забвение» (блок В ТЗ 152-ФЗ): отзыв согласия на обработку ПД.
 * Двухэтапное подтверждение: заявка {email, телефон} → код из письма →
 * обезличивание данных. Заказы сохраняются (бухгалтерия), ПД удаляются.
 */
export function PrivacyWithdrawPage() {
  const [step, setStep] = useState<"form" | "code" | "done">("form");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitRequest = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await requestPdWithdrawal(email.trim(), phone.trim() || undefined);
      setStep("code");
    } catch (err) {
      setError(
        err instanceof StorefrontApiError
          ? err.message
          : "Не удалось отправить заявку. Попробуйте позже.",
      );
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await confirmPdWithdrawal(email.trim(), code.trim());
      void logConsent("profile_deleted");
      setStep("done");
      setError(res.message || null);
    } catch (err) {
      setError(
        err instanceof StorefrontApiError
          ? err.message
          : "Не удалось подтвердить код. Попробуйте позже.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-page py-6 lg:py-8">
      <Breadcrumbs
        items={[{ label: "Главная", href: "/" }, { label: "Отзыв согласия" }]}
        className="mb-4"
      />
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-xl bg-secondary text-primary">
            <ShieldCheck className="size-6" />
          </span>
          <h1 className="text-h2">Запрос на отзыв согласия и удаление персональных данных</h1>
        </div>
        <p className="mt-3 text-body-sm leading-relaxed text-muted-foreground">
          В соответствии с Федеральным законом № 152-ФЗ «О персональных данных»
          вы имеете право в любой момент отозвать свое согласие на обработку
          данных. Заполните форму ниже. На указанный email будет отправлен код
          подтверждения. После верификации ваши личные данные (ФИО, телефон,
          email, адреса) будут безвозвратно удалены или обезличены в нашей
          системе в течение 10 рабочих дней.
        </p>

        {step === "done" ? (
          <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-success/30 bg-success/5 p-8 text-center">
            <CheckCircle2 className="size-10 text-success" />
            <p className="text-h4">Заявка подтверждена</p>
            <p className="text-body-sm text-muted-foreground">
              {error || "Персональные данные будут удалены или обезличены в течение 10 рабочих дней."}
            </p>
            <Button asChild variant="outline" className="mt-2">
              <Link href="/">На главную</Link>
            </Button>
          </div>
        ) : step === "code" ? (
          <form className="surface-card mt-8 space-y-4 p-6" onSubmit={(e) => void submitCode(e)}>
            <div className="rounded-lg border border-border bg-secondary/40 p-3 text-body-sm leading-relaxed text-muted-foreground">
              Код подтверждения отправлен на{" "}
              <span className="font-medium text-foreground">{email}</span>.
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wd-code">Код из письма</Label>
              <Input
                id="wd-code"
                inputMode="numeric"
                maxLength={6}
                required
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D+/g, ""))}
                placeholder="000000"
                className="text-center text-h4 tracking-[0.4em]"
              />
            </div>
            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-caption text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {busy ? "Подтверждаем…" : "Подтвердить удаление данных"}
            </Button>
            <button
              type="button"
              className="w-full text-caption text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground hover:underline"
              onClick={() => {
                setStep("form");
                setError(null);
              }}
            >
              Изменить данные заявки
            </button>
          </form>
        ) : (
          <form className="surface-card mt-8 space-y-4 p-6" onSubmit={(e) => void submitRequest(e)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="wd-email">Email *</Label>
                <Input
                  id="wd-email"
                  type="email"
                  required
                  placeholder="mail@example.ru"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wd-phone">Номер телефона *</Label>
                <Input
                  id="wd-phone"
                  type="tel"
                  required
                  placeholder="+7 (___) ___-__-__"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>
            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-caption text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {busy ? "Отправляем…" : "Отправить запрос"}
            </Button>
            <p className="text-caption leading-relaxed text-muted-foreground">
              Сами заказы (состав и суммы) сохраняются для корректности
              бухгалтерской отчётности и статистики продаж, но обезличиваются —
              привязываются к системной записи «Удалённый пользователь».
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
