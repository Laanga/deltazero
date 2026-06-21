"use client";

import { useMemo } from "react";

import type { TelemetryData } from "@/lib/types";

/** Mezcla los canales de todos los pilotos por índice de distancia (base = primer piloto). */
export function useMergedTelemetry(telemetry: TelemetryData[] | undefined) {
  return useMemo(() => {
    if (!telemetry?.length) return [] as Record<string, number | null>[];
    const base = telemetry[0];
    return base.channels.distance.map((dist, i) => {
      const row: Record<string, number | null> = { distance: Math.round(dist) };
      for (const t of telemetry) {
        row[`speed_${t.driver}`] = t.channels.speed[i] ?? null;
        row[`rpm_${t.driver}`] = t.channels.rpm[i] ?? null;
        row[`throttle_${t.driver}`] = t.channels.throttle[i] ?? null;
        row[`brake_${t.driver}`] = t.channels.brake[i] != null ? t.channels.brake[i] * 100 : null;
        row[`gear_${t.driver}`] = t.channels.gear[i] ?? null;
        if (telemetry.length > 1 && t.driver !== base.driver) {
          const dt = t.channels.time[i];
          const dtBase = base.channels.time[i];
          row[`delta_${t.driver}`] = dt != null && dtBase != null ? +(dt - dtBase).toFixed(3) : null;
        }
      }
      return row;
    });
  }, [telemetry]);
}
