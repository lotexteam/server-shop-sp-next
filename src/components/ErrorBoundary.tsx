"use client";

import React from "react";

interface Props { children: React.ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, maxWidth: 700, margin: "0 auto", fontFamily: "system-ui" }}>
          <h1 style={{ color: "#dc2626", fontSize: 24 }}>Ошибка рендеринга</h1>
          <pre style={{ background: "#1f2937", color: "#fca5a5", padding: 20, borderRadius: 8, overflow: "auto", fontSize: 13, marginTop: 16, whiteSpace: "pre-wrap" }}>
            {this.state.error?.message}
            {"\n\n"}
            {this.state.error?.stack?.split("\n").slice(0, 15).join("\n")}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
