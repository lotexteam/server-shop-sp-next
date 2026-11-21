import { proxyBackendFile } from "@/lib/backend-proxy";

/**
 * /.well-known/agent-card.json — карточка агента (A2A, geo-well-known).
 * Навыки и контакты собирает бэкенд из CMS: витрина не хранит их у себя.
 */
export async function GET() {
  return proxyBackendFile("/agent/agent-card.json", {
    contentType: "application/json; charset=utf-8",
  });
}
