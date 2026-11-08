"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import { Dropdown } from "@/components/ui/Dropdown";
import { useEvents } from "@/hooks/useF1Data";
import type { SessionInfo } from "@/lib/types";
import { FIRST_OPENF1_SEASON, useSessionStore } from "@/store/sessionStore";

// OpenF1 no tiene datos anteriores a 2023; solo se ofrecen temporadas con datos
const YEARS = Array.from(
  { length: new Date().getFullYear() - FIRST_OPENF1_SEASON + 1 },
  (_, i) => new Date().getFullYear() - i,
);

function sessionStarted(s: SessionInfo): boolean {
  return s.date != null && Date.parse(s.date.replace(" ", "T") + "Z") <= Date.now();
}

export function SessionSelector() {
  const { year, gp, session, setYear, setGp, setSession } = useSessionStore(
    useShallow((s) => ({
      year: s.year,
      gp: s.gp,
      session: s.session,
      setYear: s.setYear,
      setGp: s.setGp,
      setSession: s.setSession,
    })),
  );
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
    <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
      <Dropdown
        label="Temporada"
        value={String(year)}
        selectedKey={String(year)}
        options={YEARS}
        display={(y) => ({ key: String(y), text: String(y) })}
        onSelect={setYear}
        className="sm:w-36 sm:min-w-0"
      />
      <Dropdown
        label="Sesión"
        value={session ?? "Elige sesión"}
        selectedKey={session}
        options={event?.sessions ?? []}
        display={(s) => ({ key: s.code, text: `${s.code} — ${s.name}` })}
        onSelect={(s) => setSession(s.code)}
        disabled={!event}
        className="sm:order-last sm:w-56"
      />
      <Dropdown
        label="Gran Premio"
        value={
          gp ??
          (isLoading ? "Cargando…" : availableEvents.length ? "Elige Gran Premio" : "Sin datos aún")
        }
        selectedKey={gp}
        options={availableEvents}
        display={(e) => ({
          key: e.name,
          text: `R${e.round} · ${e.name}`,
          sub: `${e.location}, ${e.country}`,
        })}
        onSelect={(e) => setGp(e.name)}
        disabled={!availableEvents.length}
        className="col-span-2 sm:w-80"
      />
    </div>
  );
}
