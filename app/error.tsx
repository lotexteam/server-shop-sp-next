"use client";

/**
 * Роут-уровневый error boundary — эквивалент errorElement из router.tsx +
 * ErrorBoundary SPA. UI повторяет ErrorBoundary.tsx (тот же служебный вид),
 * плюс кнопка reset (преимущество Next).
 */

import { useEffect } from "react";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{ padding: 40, maxWidth: 700, margin: "0 auto", fontFamily: "system-ui" }}>
      <h1 style={{ color: "#dc2626", fontSize: 24 }}>Ошибка рендеринга</h1>
      <pre style={{ background: "#1f2937", color: "#fca5a5", padding: 20, borderRadius: 8, overflow: "auto", fontSize: 13, marginTop: 16, whiteSpace: "pre-wrap" }}>
        {error?.message}
        {"\n\n"}
        {error?.stack?.split("\n").slice(0, 15).join("\n")}
      </pre>
      <button
        type="button"
        onClick={reset}
        style={{ marginTop: 16, padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}
      >
        Попробовать снова
      </button>
    </div>
  );
}
