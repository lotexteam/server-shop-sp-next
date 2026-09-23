/**
 * Стили MapLibre для карты контактов. Открытые стили OpenFreeMap не требуют
 * API-ключей; «custom» — свой JSON-стиль по https-URL из админки.
 *
 * maxZoom 18, а не 24: MapLibre v6 оверскейлит 4 уровня (zoomLevelsToOverscale)
 * и просит тайлы вплоть до `maxZoom - 4`, а у OpenFreeMap данные кончаются на
 * z14 (tilejson maxzoom 14). Тайлы глубже отсекает hasTile() — источник
 * остаётся без тайлов вовсе, и вместо карты белый экран.
 */
export type MapStyleName = "liberty" | "bright" | "positron" | "custom";

export const MAP_STYLE_NAMES: readonly MapStyleName[] = [
  "liberty",
  "bright",
  "positron",
  "custom",
];

const STYLE_SOURCES: Record<MapStyleName, { url: string; maxZoom: number }> = {
  liberty: { url: "https://tiles.openfreemap.org/styles/liberty", maxZoom: 18 },
  bright: { url: "https://tiles.openfreemap.org/styles/bright", maxZoom: 18 },
  positron: {
    url: "https://tiles.openfreemap.org/styles/positron",
    maxZoom: 18,
  },
  custom: { url: "", maxZoom: 18 },
};

/** URL стиля; пустой/не-www https у custom → фолбэк на liberty. */
export function mapStyleUrl(
  name?: MapStyleName | null,
  customUrl?: string | null,
): string {
  if (name === "custom") {
    const url = customUrl?.trim() ?? "";
    return url.startsWith("https://") ? url : STYLE_SOURCES.liberty.url;
  }
  return STYLE_SOURCES[name ?? "liberty"].url;
}

export function mapStyleMaxZoom(name?: MapStyleName | null): number {
  return STYLE_SOURCES[name ?? "liberty"].maxZoom;
}

/** Значение из API → MapStyleName; неизвестное (и custom без https-URL) → liberty. */
export function mapStyleName(style: unknown, styleUrl?: unknown): MapStyleName {
  if (!MAP_STYLE_NAMES.includes(style as MapStyleName)) return "liberty";
  if (style === "custom") {
    const url = typeof styleUrl === "string" ? styleUrl.trim() : "";
    return url.startsWith("https://") ? "custom" : "liberty";
  }
  return style as MapStyleName;
}
