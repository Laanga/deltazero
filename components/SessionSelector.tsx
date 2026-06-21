"use client";

import { useMemo } from "react";

import { Dropdown } from "@/components/ui/Dropdown";
import { useEvents } from "@/hooks/useF1Data";
import type { SessionInfo } from "@/lib/types";
import { useSessionStore } from "@/store/sessionStore";

// OpenF1 no tiene datos anteriores a 2023; solo se ofrecen temporadas con datos
const FIRST_OPENF1_SEASON = 2023;
const YEARS = Array.from(
  { length: new Date().getFullYear() - FIRST_OPENF1_SEASON + 1 },
  (_, i) => new Date().getFullYear() - i,
);

function sessionStarted(s: SessionInfo): boolean {
  return s.date != null && Date.parse(s.date) <= Date.now();
}

export function SessionSelector() {
  const { year, gp, session, setYear, setGp, setSession } = useSessionStore();
  const { data: events, isLoading } = useEvents();

  // Solo GPs y sesiones que ya se han disputado (las futuras no tienen datos)
  const availableEvents = useMemo(
    () =>
      (events ?? [])
        .map((e) => ({ ...e, sessions: e.sessions.filter(sessionStarted) }))
        .filter((e) => e.sessions.length > 0),
    [events],
  );
  const event = availableEvents.find((e) => e.name === gp);

  return (
    <div className="flex flex-wrap items-end gap-4">
      <Dropdown
        label="Temporada"
        value={String(year)}
        options={YEARS}
        display={(y) => ({ key: String(y), text: String(y) })}
        onSelect={setYear}
      />
      <Dropdown
        label="Gran Premio"
        value={
          gp ??
          (isLoading
            ? "Cargando…"
            : availableEvents.length
              ? "Selecciona GP"
              : "Sin datos aún")
        }
        options={availableEvents}
        display={(e) => ({
          key: e.name,
          text: `R${e.round} · ${e.name}`,
          sub: `${e.location}, ${e.country}`,
        })}
        onSelect={(e) => setGp(e.name)}
        disabled={!availableEvents.length}
      />
      <Dropdown
        label="Sesión"
        value={session ?? "Selecciona sesión"}
        options={event?.sessions ?? []}
        display={(s) => ({ key: s.code, text: `${s.code} — ${s.name}` })}
        onSelect={(s) => setSession(s.code)}
        disabled={!event}
      />
    </div>
  );
}
