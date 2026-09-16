import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge не знает кастомные font-size утилиты проекта (body, h*, caption…)
 * и считает text-body цветовым классом — из-за этого он «побеждает» text-white
 * и другие цвета при слиянии классов. Явно относим их к группе font-size.
 */
const twMergeCustom = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["display", "h1", "h2", "h3", "h4", "h5", "h6", "body-lg", "body", "body-sm", "caption"] },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMergeCustom(clsx(inputs));
}

/** Format a number as RUB currency, e.g. 124900 -> "124 900 ₽" */
export function formatPrice(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Plain grouped number, e.g. 1299 -> "1 299" */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}
