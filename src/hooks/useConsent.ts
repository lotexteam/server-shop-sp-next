"use client";

import { useSyncExternalStore } from "react";
import {
  getConsentState,
  subscribeConsent,
  type ConsentState,
} from "@/lib/consent/consent";

/** React-биндинг к модулю согласий (баннер/модалка/чекбоксы форм). */
export function useConsent(): ConsentState {
  return useSyncExternalStore(subscribeConsent, getConsentState, getConsentState);
}
