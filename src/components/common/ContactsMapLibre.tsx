"use client";

import { useEffect, useRef } from "react";
import { Map as MLMap, Marker, NavigationControl, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { cn } from "@/lib/utils";
import {
  mapStyleMaxZoom,
  mapStyleUrl,
  type MapStyleName,
} from "@/lib/mapStyles";

export type ContactsMapLibreProps = {
  lat: number;
  lng: number;
  zoom: number;
  title?: string | null;
  /** Стиль из админки (Настройки → Контакты → Карта); по умолчанию liberty. */
  style?: MapStyleName | null;
  /** JSON-стиль по своему URL — работает только при style === "custom". */
  styleUrl?: string | null;
  className?: string;
};

/**
 * Карта контактов на MapLibre GL (стили OpenFreeMap — бесплатно, без API-ключей,
 * либо свой JSON-стиль). Точка настраивается в админке
 * (Настройки → Контакты → Карта).
 */
export function ContactsMapLibre({
  lat,
  lng,
  zoom,
  title,
  style,
  styleUrl,
  className,
}: ContactsMapLibreProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const maxZoom = mapStyleMaxZoom(style);
    const map = new MLMap({
      container: ref.current,
      style: mapStyleUrl(style, styleUrl),
      center: [lng, lat],
      zoom: Math.min(zoom, maxZoom),
      maxZoom,
      // не перехватывать прокрутку страницы витрины
      scrollZoom: false,
    });
    new Marker({ color: "#e11d48" }).setLngLat([lng, lat]).addTo(map);
    if (title) {
      new Popup({ closeOnClick: false, offset: 26 })
        .setLngLat([lng, lat])
        .setText(title)
        .addTo(map);
    }
    map.addControl(
      new NavigationControl({ visualizePitch: false }),
      "top-left",
    );
    return () => {
      map.remove();
    };
  }, [lat, lng, zoom, title, style, styleUrl]);

  return (
    <div
      ref={ref}
      className={cn("h-72 w-full min-h-[18rem] lg:h-full", className)}
    />
  );
}

export default ContactsMapLibre;
