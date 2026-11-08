"use client";

import { useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import { Dropdown } from "@/components/ui/Dropdown";
import { useLaps } from "@/hooks/useF1Data";
import { useSessionStore } from "@/store/sessionStore";

export function LapPicker() {
  const { lap, setLap, selectedDrivers } = useSessionStore(
    useShallow((s) => ({ lap: s.lap, setLap: s.setLap, selectedDrivers: s.selectedDrivers })),
  );
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
  const options = ["fastest", ...lapOptions.map(String)];
  return (
    <Dropdown
      compact
      label="Vuelta"
      value={lap === "fastest" ? "Más rápida" : `Vuelta ${lap}`}
      selectedKey={lap}
      options={options}
      display={(o) => ({
        key: o,
        text: o === "fastest" ? "Más rápida de cada piloto" : `Vuelta ${o}`,
      })}
      onSelect={setLap}
    />
  );
}
