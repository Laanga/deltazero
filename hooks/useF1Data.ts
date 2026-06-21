"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { useSessionStore } from "@/store/sessionStore";

// Las sesiones de F1 son históricas e inmutables: cache agresivo.
const STATIC = { staleTime: Infinity, gcTime: 30 * 60_000 } as const;

export function useEvents() {
  const year = useSessionStore((s) => s.year);
  return useQuery({ queryKey: ["events", year], queryFn: () => api.events(year), ...STATIC });
}

export function useDrivers() {
  const { year, gp, session } = useSessionStore();
  return useQuery({
    queryKey: ["drivers", year, gp, session],
    queryFn: () => api.drivers(year, gp!, session!),
    enabled: !!gp && !!session,
    ...STATIC,
    // La primera carga de una sesión puede tardar por el rate limit de OpenF1: paciencia.
    retry: 1,
  });
}

export function useLaps() {
  const { year, gp, session, selectedDrivers } = useSessionStore();
  return useQuery({
    queryKey: ["laps", year, gp, session, selectedDrivers],
    queryFn: () => api.laps(year, gp!, session!, selectedDrivers),
    enabled: !!gp && !!session && selectedDrivers.length > 0,
    ...STATIC,
  });
}

export function useTelemetry() {
  const { year, gp, session, selectedDrivers, lap } = useSessionStore();
  return useQuery({
    queryKey: ["telemetry", year, gp, session, selectedDrivers, lap],
    queryFn: () => api.telemetry(year, gp!, session!, selectedDrivers, lap),
    enabled: !!gp && !!session && selectedDrivers.length > 0,
    ...STATIC,
  });
}

export function useCircuit() {
  const { year, gp, session } = useSessionStore();
  return useQuery({
    queryKey: ["circuit", year, gp, session],
    queryFn: () => api.circuit(),
    enabled: !!gp && !!session,
    ...STATIC,
  });
}

export function usePositions() {
  const { year, gp } = useSessionStore();
  return useQuery({
    queryKey: ["positions", year, gp],
    queryFn: () => api.positions(year, gp!),
    enabled: !!gp,
    ...STATIC,
  });
}

export function useGaps() {
  const { year, gp } = useSessionStore();
  return useQuery({
    queryKey: ["gaps", year, gp],
    queryFn: () => api.gaps(year, gp!),
    enabled: !!gp,
    ...STATIC,
  });
}

export function useRaceEvents() {
  const { year, gp } = useSessionStore();
  return useQuery({
    queryKey: ["raceEvents", year, gp],
    queryFn: () => api.raceEvents(year, gp!),
    enabled: !!gp,
    ...STATIC,
  });
}

export function useResults() {
  const { year, gp } = useSessionStore();
  return useQuery({
    queryKey: ["results", year, gp],
    queryFn: () => api.results(year, gp!),
    enabled: !!gp,
    ...STATIC,
  });
}

export function useStrategy() {
  const { year, gp } = useSessionStore();
  return useQuery({
    queryKey: ["strategy", year, gp],
    queryFn: () => api.strategy(year, gp!),
    enabled: !!gp,
    ...STATIC,
  });
}

export function useDriverStandings() {
  const year = useSessionStore((s) => s.year);
  return useQuery({
    queryKey: ["driverStandings", year],
    queryFn: () => api.driverStandings(year),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}

export function useConstructorStandings() {
  const year = useSessionStore((s) => s.year);
  return useQuery({
    queryKey: ["constructorStandings", year],
    queryFn: () => api.constructorStandings(year),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}
