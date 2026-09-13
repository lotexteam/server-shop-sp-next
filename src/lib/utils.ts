import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
