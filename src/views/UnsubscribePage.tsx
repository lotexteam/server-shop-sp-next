"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MailX, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/common/Section";
import {
  apiUnsubscribeNewsletter,
  StorefrontApiError,
} from "@/lib/api";

/**
 * Landing for the «Отписаться» link inside newsletter emails:
 * /unsubscribe?email=...&token=...
 */
export function UnsubscribePage() {
  const params = useSearchParams();
  const email = params.get("email") || "";
  const token = params.get("token") || "";

  const [state, setState] = useState<"loading" | "done" | "error">(
    !email || !token ? "error" : "loading",
  );
  const [message, setMessage] = useState("");
  const fired = useRef(false);

  useEffect(() => {
    if (state !== "loading" || fired.current) return;
    fired.current = true;
    apiUnsubscribeNewsletter(email, token)
      .then((res) => {
        setState("done");
        setMessage(res.message);
      })
      .catch((err) => {
        setState("error");
        setMessage(
          err instanceof StorefrontApiError
            ? err.message
            : "Не удалось отписаться. Попробуйте позже.",
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Section>
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-xl border border-border bg-card p-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <MailX className="size-6" />
        </span>
        <h1 className="text-h4 font-bold">Отписка от рассылки</h1>
        {state === "loading" && (
          <p className="text-body-sm text-muted-foreground">Обрабатываем запрос…</p>
        )}
        {state === "done" && (
          <>
            <p className="text-body-sm text-muted-foreground">{message}</p>
            <p className="text-caption text-muted-foreground">
              Жаль терять вас! Заново подписаться можно в подвале сайта.
            </p>
          </>
        )}
        {state === "error" && (
          <>
            <p className="text-body-sm text-destructive">{message}</p>
            <p className="text-caption text-muted-foreground">
              Ссылка недействительна или устарела. Отписаться можно заново из
              другого письма рассылки.
            </p>
          </>
        )}
        <Button variant="outline" asChild className="mt-2">
          <Link href="/">
            <Home className="size-4" /> На главную
          </Link>
        </Button>
      </div>
    </Section>
  );
}
