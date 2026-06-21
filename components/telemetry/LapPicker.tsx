"use client";

import { useEffect, useMemo } from "react";

import { useLaps } from "@/hooks/useF1Data";
import { useSessionStore } from "@/store/sessionStore";

export function LapPicker() {
  const { lap, setLap, selectedDrivers } = useSessionStore();
  const { data: laps } = useLaps();

  // Solo vueltas con tiempo válido para TODOS los pilotos seleccionados:
  // elegir una que a alguno le falte rompería la carga de telemetría
  const lapOptions = useMemo(() => {
    if (!laps) return [];
    const driversPerLap = new Map<number, Set<string>>();
    for (const l of laps) {
      if (l.lap_time == null) continue;
      const set = driversPerLap.get(l.lap_number) ?? new Set();
      set.add(l.driver);
      driversPerLap.set(l.lap_number, set);
    }
    return [...driversPerLap.entries()]
      .filter(([, set]) => selectedDrivers.every((d) => set.has(d)))
      .map(([n]) => n)
      .sort((a, b) => a - b);
  }, [laps, selectedDrivers]);

  // Si la vuelta elegida deja de ser válida (cambió la selección), vuelve a "Más rápida"
  useEffect(() => {
    if (lap !== "fastest" && laps && !lapOptions.includes(Number(lap))) setLap("fastest");
  }, [lap, laps, lapOptions, setLap]);

  if (selectedDrivers.length === 0) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Vuelta</span>
      <select
        value={lap}
        onChange={(e) => setLap(e.target.value)}
        className="rounded border border-edge bg-panel px-3 py-1.5 text-sm font-semibold outline-none transition-colors hover:border-f1red/50"
      >
        <option value="fastest">Más rápida</option>
        {lapOptions.map((n) => (
          <option key={n} value={String(n)}>
            Vuelta {n}
          </option>
        ))}
      </select>
    </div>
  );
}
