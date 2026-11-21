import { proxyBackendFile } from "@/lib/backend-proxy";

/**
 * /index.md — Markdown-версия главной (geo-markdown-response).
 * Содержимое собирает бэкенд из CMS: описание сайта, категории, страницы,
 * контакты. Витрина отвечает только за публичный адрес и Content-Type.
 */
export async function GET() {
  return proxyBackendFile("/agent/index-md", {
    contentType: "text/markdown; charset=utf-8",
  });
}
