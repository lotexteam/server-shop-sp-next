import type { ConditionGrade } from "./types";

export const CONDITION_LABEL: Record<ConditionGrade, string> = {
  new: "Новое",
  used: "Б/у",
};

export const CONDITION_TONE: Record<ConditionGrade, string> = {
  new: "bg-success/10 text-success",
  used: "bg-muted text-muted-foreground",
};
