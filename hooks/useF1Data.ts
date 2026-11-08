"use client";

import { useQueries, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useCallback } from "react";
import { useShallow } from "zustand/react/shallow";

import { api } from "@/lib/api";
import type { LapData, TelemetryData } from "@/lib/types";
import { useSessionStore } from "@/store/sessionStore";

// Las sesiones de F1 son históricas e inmutables: cache agresivo.
const STATIC = { staleTime: Infinity, gcTime: 30 * 60_000 } as const;

/** Solo las claves que identifican la sesión: no re-renderiza al cambiar pilotos o pestaña. */
function useSessionKey() {
  return useSessionStore(useShallow((s) => ({ year: s.year, gp: s.gp, session: s.session })));
}

export function useEvents() {
  const year = useSessionStore((s) => s.year);
  return useQuery({ queryKey: ["events", year], queryFn: () => api.events(year), ...STATIC });
}

export function useDrivers() {
  const { year, gp, session } = useSessionKey();
  return useQuery({
    queryKey: ["drivers", year, gp, session],
    queryFn: () => api.drivers(year, gp!, session!),
    enabled: !!gp && !!session,
    ...STATIC,
    // La primera carga de una sesión puede tardar por el rate limit de OpenF1: paciencia.
    retry: 1,
  });
}

/**
 * Vueltas de los pilotos seleccionados. Se descarga la sesión completa una vez
 * (misma query para cualquier selección) y se filtra en cliente con `select`.
 */
export function useLaps() {
  const { year, gp, session } = useSessionKey();
  const selectedDrivers = useSessionStore((s) => s.selectedDrivers);
  const select = useCallback(
    (laps: LapData[]) => {
      const wanted = new Set(selectedDrivers);
      return laps.filter((l) => wanted.has(l.driver));
    },
    [selectedDrivers],
  );
  return useQuery({
    queryKey: ["laps", year, gp, session],
    queryFn: () => api.laps(year, gp!, session!),
    enabled: !!gp && !!session && selectedDrivers.length > 0,
    select,
    ...STATIC,
  });
}

export interface TelemetryResult {
  /** Telemetría de los pilotos que han cargado, en el orden de selección. */
  data: TelemetryData[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  /** Pilotos cuya telemetría falló (los demás se muestran igualmente). */
  failed: string[];
}

/** Una query por piloto: añadir o quitar uno no vuelve a descargar los demás. */
export function useTelemetry(): TelemetryResult {
  const { year, gp, session } = useSessionKey();
  const { selectedDrivers, lap } = useSessionStore(
    useShallow((s) => ({ selectedDrivers: s.selectedDrivers, lap: s.lap })),
  );

  const combine = useCallback(
    (results: UseQueryResult<TelemetryData>[]): TelemetryResult => {
      const data: TelemetryData[] = [];
      const failed: string[] = [];
      let error: Error | null = null;
      results.forEach((r, i) => {
        if (r.data) data.push(r.data);
        else if (r.isError) {
          failed.push(selectedDrivers[i]);
          error ??= r.error;
        }
      });
      const pending = results.some((r) => r.isPending && r.fetchStatus !== "idle");
      return {
        data,
        // Esperar a que lleguen todos evita que las gráficas se redibujen piloto a piloto
        isLoading: pending,
        isError: results.length > 0 && failed.length === results.length,
        error,
        failed,
      };
    },
    [selectedDrivers],
  );

  return useQueries({
    queries: selectedDrivers.map((driver) => ({
      queryKey: ["telemetry", year, gp, session, driver, lap],
      queryFn: () => api.telemetry(year, gp!, session!, driver, lap),
      enabled: !!gp && !!session,
      ...STATIC,
    })),
    combine,
  });
}

export function useCircuit() {
  const year = useSessionStore((s) => s.year);
  const gp = useSessionStore((s) => s.gp);
  return useQuery({
    queryKey: ["circuit", year, gp],
    queryFn: () => api.circuit(year, gp!),
    enabled: !!gp,
    ...STATIC,
  });
}

/** Factoría para las queries de carrera, que solo dependen de año + GP. */
function raceQuery<T>(name: string, fn: (year: number, gp: string) => Promise<T>) {
  return function useRaceQuery() {
    const year = useSessionStore((s) => s.year);
    const gp = useSessionStore((s) => s.gp);
    return useQuery({
      queryKey: [name, year, gp],
      queryFn: () => fn(year, gp!),
      enabled: !!gp,
      ...STATIC,
    });
  };
}

export const usePositions = raceQuery("positions", api.positions);
export const useGaps = raceQuery("gaps", api.gaps);
export const useRaceEvents = raceQuery("raceEvents", api.raceEvents);
export const useResults = raceQuery("results", api.results);
export const useStrategy = raceQuery("strategy", api.strategy);

const STANDINGS = { staleTime: 5 * 60_000, gcTime: 30 * 60_000 } as const;

export function useDriverStandings() {
  const year = useSessionStore((s) => s.year);
  return useQuery({
    queryKey: ["driverStandings", year],
    queryFn: () => api.driverStandings(year),
    ...STANDINGS,
  });
}

export function useConstructorStandings() {
  const year = useSessionStore((s) => s.year);
  return useQuery({
    queryKey: ["constructorStandings", year],
    queryFn: () => api.constructorStandings(year),
    ...STANDINGS,
  });
}
