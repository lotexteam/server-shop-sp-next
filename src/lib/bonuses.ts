/** 1 бонус = 1 ₽ */
export const BONUS_RUB = 1;

export type BonusTxType = "earn" | "redeem" | "expire" | "adjust";

export interface BonusTransaction {
  id: string;
  type: BonusTxType;
  amount: number; // positive = credit, negative = debit
  balanceAfter: number;
  title: string;
  description?: string;
  orderId?: string;
  date: string; // ISO or display
}

// Лимиты списания/начисления живут на сервере (группа покупателя,
// POST /account/bonuses/preview). Локальных процентов и порогов здесь нет.

export function formatBonus(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(n);
}

export function bonusWord(n: number): string {
  const abs = Math.abs(n) % 100;
  const d = abs % 10;
  if (abs > 10 && abs < 20) return "бонусов";
  if (d === 1) return "бонус";
  if (d >= 2 && d <= 4) return "бонуса";
  return "бонусов";
}
