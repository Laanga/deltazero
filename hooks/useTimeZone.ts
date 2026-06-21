"use client";

import { useEffect, useState } from "react";

// Zona por defecto en SSR/primer render (evita desajuste de hidratación).
// Tras montar, se sustituye por la zona real del navegador.
const DEFAULT_TZ = "Europe/Madrid";

/** Zona horaria del usuario, estable en hidratación (default hasta montar). */
export function useTimeZone(): string {
  const [tz, setTz] = useState(DEFAULT_TZ);
  useEffect(() => {
    try {
      const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (resolved) setTz(resolved);
    } catch {
      /* mantén el default */
    }
  }, []);
  return tz;
}

/** Etiqueta corta de una zona (p. ej. "CEST", "GMT+2") para badges. */
export function tzShortLabel(tz: string, ref: Date): string {
  try {
    const parts = new Intl.DateTimeFormat("es-ES", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(ref);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "LOCAL";
  } catch {
    return "LOCAL";
  }
}
