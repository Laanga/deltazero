"use client";

import { useSyncExternalStore } from "react";

// Zona por defecto en SSR/primer render (evita desajuste de hidratación).
// En cliente se usa la zona real del navegador.
const DEFAULT_TZ = "Europe/Madrid";

const subscribe = () => () => {};
function browserTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TZ;
  } catch {
    return DEFAULT_TZ;
  }
}

/** Zona horaria del usuario, estable en hidratación. */
export function useTimeZone(): string {
  return useSyncExternalStore(subscribe, browserTz, () => DEFAULT_TZ);
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
