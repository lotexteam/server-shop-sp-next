export type ConfigurationLine = {
  slot: string;
  name: string;
  qty: number;
};

type ConfigurationSource = {
  composition?: Array<{ slot: string; name: string; qty: number }>;
  specs?: Array<{ label: string; value: string }>;
};

/** Prefer the structured BOM; specs are a compatibility fallback for older cart lines. */
export function getConfigurationLines(source: ConfigurationSource): ConfigurationLine[] {
  if (source.composition?.length) {
    return source.composition.map((row) => ({
      slot: row.slot.trim() || "Комплектующая",
      name: row.name.trim() || "Без названия",
      qty: Math.max(1, Number(row.qty) || 1),
    }));
  }

  return (source.specs ?? []).map((row) => ({
    slot: row.label.trim() || "Комплектующая",
    name: row.value.trim() || "Без названия",
    qty: 1,
  }));
}

export function formatConfigurationLine(row: ConfigurationLine): string {
  return `${row.slot}: ${row.name} x ${row.qty}`;
}
