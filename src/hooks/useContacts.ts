"use client";

import { useEffect, useState } from "react";
import { fetchContacts, type ShopContacts } from "@/lib/api";

let cache: ShopContacts | null = null;
let inflight: Promise<ShopContacts> | null = null;

export async function loadContacts(force = false): Promise<ShopContacts> {
  if (!force && cache) return cache;
  if (!force && inflight) return inflight;
  inflight = fetchContacts()
    .then((c) => {
      cache = c;
      return c;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useContacts() {
  const [contacts, setContacts] = useState<ShopContacts | null>(cache);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let cancelled = false;
    void loadContacts().then((c) => {
      if (!cancelled) {
        setContacts(c);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { contacts, loading };
}
