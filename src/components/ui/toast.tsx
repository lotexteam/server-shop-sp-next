"use client";

import * as React from "react";
import { CheckCircle2, Info, XCircle, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info" | "warning";
interface ToastItem { id: number; title: string; description?: string; variant: ToastVariant; action?: { label: string; onClick: () => void }; }
interface ToastCtx { push: (t: Omit<ToastItem, "id">) => void; }

const Ctx = React.createContext<ToastCtx | null>(null);
export const useToast = () => {
  const c = React.useContext(Ctx);
  if (!c) throw new Error("useToast must be used within <ToastProvider>");
  return c;
};

const icons = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle };
const tones = { success: "text-success", error: "text-destructive", info: "text-primary", warning: "text-warning-foreground" };

let counter = 0;
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  /** id тостов, которые сейчас играют CSS-выход: снимаем узел через 200 мс */
  const [leaving, setLeaving] = React.useState<number[]>([]);

  const remove = React.useCallback((id: number) => {
    setLeaving((s) => (s.includes(id) ? s : [...s, id]));
    setTimeout(() => {
      setItems((s) => s.filter((i) => i.id !== id));
      setLeaving((s) => s.filter((x) => x !== id));
    }, 200);
  }, []);

  const push = React.useCallback(
    (t: Omit<ToastItem, "id">) => {
      const id = ++counter;
      setItems((s) => [...s, { ...t, id }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove],
  );

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[100] flex w-auto max-w-sm flex-col gap-2 sm:left-auto sm:right-4">
        {items.map((t) => {
          const Icon = icons[t.variant];
          return (
            <div
              key={t.id}
              className={cn(
                "pointer-events-auto flex items-start gap-3 rounded-md border border-border bg-card p-4 shadow-elevated",
                leaving.includes(t.id) ? "toast-out" : "toast-in",
              )}
            >
              <Icon className={cn("mt-0.5 size-5 shrink-0", tones[t.variant])} />
              <div className="flex-1 space-y-0.5">
                <p className="text-body-sm font-semibold">{t.title}</p>
                {t.description && <p className="text-caption text-muted-foreground">{t.description}</p>}
                {t.action && <button type="button" onClick={() => { t.action?.onClick(); remove(t.id); }} className="mt-2 text-caption font-semibold text-primary underline-offset-2 hover:underline">{t.action.label}</button>}
              </div>
              <button onClick={() => remove(t.id)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
