"use client";

import { useEffect, useRef } from "react";
import { Map as MLMap, Marker, NavigationControl, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { cn } from "@/lib/utils";

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

export type ContactsMapLibreProps = {
  lat: number;
  lng: number;
  zoom: number;
  title?: string | null;
  className?: string;
};

/**
 * Карта контактов на MapLibre GL (стиль OpenFreeMap — бесплатно, без API-ключей).
 * Точка настраивается в админке (Настройки → Контакты → Карта).
 */
export function ContactsMapLibre({
  lat,
  lng,
  zoom,
  title,
  className,
}: ContactsMapLibreProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const map = new MLMap({
      container: ref.current,
      style: STYLE_URL,
      center: [lng, lat],
      zoom,
      maxZoom: 24,
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
    map.addControl(new NavigationControl({ visualizePitch: false }), "top-left");
    return () => {
      map.remove();
    };
  }, [lat, lng, zoom, title]);

  return (
    <div
      ref={ref}
      className={cn("h-72 w-full min-h-[18rem] lg:h-full", className)}
    />
  );
}

export default ContactsMapLibre;
