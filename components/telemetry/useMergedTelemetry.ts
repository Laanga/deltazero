"use client";

import { useMemo } from "react";

import { alignedDistance, deltaSeries } from "@/lib/duel";
import { valueAtDistance } from "@/lib/f1math";
import type { TelemetryData } from "@/lib/types";

const CHANNELS = ["speed", "rpm", "throttle", "brake", "gear"] as const;

/**
 * Mezcla los canales de todos los pilotos sobre la rejilla de la referencia
 * (primer piloto). Los demás se muestrean en la MISMA FRACCIÓN de vuelta, no
 * en el mismo metro: cada piloto integra su propia distancia y sus longitudes
 * difieren unos metros, que al final de la vuelta descuadrarían frenadas,
 * curvas y el delta.
 */
export function useMergedTelemetry(telemetry: TelemetryData[] | undefined) {
  return useMemo(() => {
    if (!telemetry?.length) return [] as Record<string, number | null>[];
    const ref = telemetry[0];
    const deltas = new Map(telemetry.slice(1).map((t) => [t.driver, deltaSeries(ref, t)]));

    return ref.channels.distance.map((dist, i) => {
      const row: Record<string, number | null> = { distance: Math.round(dist) };
      for (const t of telemetry) {
        const d = t === ref ? dist : alignedDistance(ref, t, dist);
        for (const ch of CHANNELS) {
          let v =
            t === ref ? t.channels[ch][i] : valueAtDistance(t.channels.distance, t.channels[ch], d);
          if (ch === "gear") v = Math.round(v);
          if (ch === "brake") v = Math.round(v) * 100;
          row[`${ch}_${t.driver}`] = Number.isFinite(v) ? v : null;
        }
        const dl = deltas.get(t.driver);
        if (dl) row[`delta_${t.driver}`] = +dl[i].toFixed(3);
      }
      return row;
    });
  }, [telemetry]);
}
