"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
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
  const push = React.useCallback((t: Omit<ToastItem, "id">) => {
    const id = ++counter;
    setItems((s) => [...s, { ...t, id }]);
    setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 4000);
  }, []);
  const remove = (id: number) => setItems((s) => s.filter((i) => i.id !== id));

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[100] flex w-auto max-w-sm flex-col gap-2 sm:left-auto sm:right-4">
        <AnimatePresence>
          {items.map((t) => {
            const Icon = icons[t.variant];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, x: 40, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="pointer-events-auto flex items-start gap-3 rounded-md border border-border bg-card p-4 shadow-elevated"
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
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
