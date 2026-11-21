import { proxyBackendFile } from "@/lib/backend-proxy";

/**
 * /AGENTS.md — инструкции для AI-агентов (geo-agents-md).
 * Текст генерирует бэкенд из CMS (seo_agent_settings, cms.contacts,
 * настройки сайта) и отдаёт по /api/v1/agent/agents-md.
 */
export async function GET() {
  return proxyBackendFile("/agent/agents-md", {
    contentType: "text/markdown; charset=utf-8",
  });
}
