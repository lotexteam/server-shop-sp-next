import { proxyBackendFile } from "@/lib/backend-proxy";

/**
 * /.well-known/mcp.json — манифест HTTP-инструментов для агентов
 * (geo-well-known). Формируется бэкендом из CMS (ключевые страницы, контакты),
 * чтобы не дублировать данные витрины в коде фронтенда.
 */
export async function GET() {
  return proxyBackendFile("/agent/mcp.json", {
    contentType: "application/json; charset=utf-8",
  });
}
