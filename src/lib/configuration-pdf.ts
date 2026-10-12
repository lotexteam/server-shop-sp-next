import { API_BASE } from "@/lib/api-base";

type Selection = { slot_id: string; product_id: string; qty: number };

/** Request a server-rendered PDF so prices and the document layout match the API. */
export async function fetchConfigurationPdf(
  productKey: string,
  payload: {
    selections: Selection[];
    qty: number;
    warranty_term_id?: string;
    warranty_package_id?: string;
  },
): Promise<Blob> {
  const response = await fetch(
    `${API_BASE}/products/${encodeURIComponent(productKey)}/configurator/pdf`,
    {
      method: "POST",
      headers: { Accept: "application/json, application/pdf", "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || "Не удалось сформировать PDF конфигурации");
  }
  if (!response.headers.get("Content-Type")?.includes("application/pdf")) {
    throw new Error("Сервер не вернул PDF конфигурации");
  }
  return response.blob();
}
