"use client";

import { useGSAP } from "@gsap/react";
import { AnimatePresence, motion } from "framer-motion";
import gsap from "gsap";
import { CalendarDays, CheckCircle2, ChevronDown, Flag, MapPin, Trophy, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ChartSkeleton, EmptyState } from "@/components/ChartPanel";
import { ConstructorsChampionship } from "@/components/championship/ConstructorsChampionship";
import { DriversChampionship } from "@/components/championship/DriversChampionship";
import { MiniTrack } from "@/components/calendar/MiniTrack";
import {
  SessionResultsModal,
  type ResultsTarget,
} from "@/components/calendar/SessionResultsModal";
import { useEvents } from "@/hooks/useF1Data";
import { useTimeZone, tzShortLabel } from "@/hooks/useTimeZone";
import type { EventInfo, SessionInfo } from "@/lib/types";
import { useSessionStore } from "@/store/sessionStore";

type CalSubTab = "races" | "drivers" | "constructors";

const SUB_TABS: { id: CalSubTab; label: string; icon: React.ReactNode }[] = [
  { id: "races", label: "Calendario", icon: <CalendarDays size={15} /> },
  { id: "drivers", label: "Pilotos", icon: <Users size={15} /> },
  { id: "constructors", label: "Constructores", icon: <Trophy size={15} /> },
];

function CalSubNav({ active, onChange }: { active: CalSubTab; onChange: (t: CalSubTab) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const btn = ref.current?.querySelector<HTMLButtonElement>(`[data-subtab="${active}"]`);
      if (btn && indicatorRef.current) {
        gsap.to(indicatorRef.current, {
          x: btn.offsetLeft,
          width: btn.offsetWidth,
          duration: 0.4,
          ease: "elastic.out(1, 0.75)",
        });
      }
    },
    { dependencies: [active], scope: ref },
  );

  return (
    <div ref={ref} className="relative flex w-fit gap-1 rounded-md border border-edge bg-panel p-1">
      <div
        ref={indicatorRef}
        className="absolute top-1 bottom-1 left-0 rounded bg-f1red/90 shadow-lg shadow-f1red/30"
        style={{ width: 0 }}
      />
      {SUB_TABS.map((t) => (
        <button
          key={t.id}
          data-subtab={t.id}
          onClick={() => onChange(t.id)}
          className={`relative z-10 flex items-center gap-2 rounded px-4 py-2 text-sm font-bold uppercase tracking-wide transition-colors duration-300
            ${active === t.id ? "text-white" : "text-zinc-500 hover:text-zinc-200"}`}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}

gsap.registerPlugin(useGSAP);

const SESSION_LABELS: Record<string, string> = {
  FP1: "Libres 1",
  FP2: "Libres 2",
  FP3: "Libres 3",
  Q: "Clasificación",
  SQ: "Sprint Quali",
  Sprint: "Sprint",
  R: "Carrera",
};

function utcDate(s: string | null): Date | null {
  if (!s) return null;
  return new Date(s.replace(" ", "T") + "Z");
}

/** Hora en la zona del usuario desde la fecha UTC. */
function localTime(s: string | null, tz: string): string {
  const d = utcDate(s);
  if (!d) return "—";
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: tz });
}

function localDay(s: string | null, tz: string): string {
  const d = utcDate(s);
  if (!d) return "";
  return d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", timeZone: tz });
}

/** Hora local del circuito: viene como "2026-07-03 12:30:00+01:00" — mostramos la hora tal cual. */
function circuitTime(s: string | null): string {
  if (!s || s.length < 16) return "—";
  return s.slice(11, 16);
}

function raceDate(ev: EventInfo): Date | null {
  const race = ev.sessions.find((s) => s.code === "R") ?? ev.sessions[ev.sessions.length - 1];
  return utcDate(race?.date ?? ev.date);
}

function eventDateRange(ev: EventInfo, tz: string): string {
  const first = utcDate(ev.sessions[0]?.date ?? null);
  const last = raceDate(ev);
  if (!first || !last) return "";
  const opts = { day: "numeric", month: "short", timeZone: tz } as const;
  const f = first.toLocaleDateString("es-ES", opts);
  const l = last.toLocaleDateString("es-ES", opts);
  return f === l ? f : `${f} — ${l}`;
}

function Countdown({ target }: { target: Date }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = Math.max(0, target.getTime() - now);
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  const secs = Math.floor((diff % 60_000) / 1000);

  const cells = [
    { value: days, label: "días" },
    { value: hours, label: "horas" },
    { value: mins, label: "min" },
    { value: secs, label: "seg" },
  ];

  return (
    <div className="flex gap-3">
      {cells.map((c) => (
        <div
          key={c.label}
          className="flex w-18 flex-col items-center rounded-md border border-f1red/30 bg-black/40 px-3 py-2 backdrop-blur"
        >
          <span className="font-mono text-3xl font-black tabular-nums">
            {String(c.value).padStart(2, "0")}
          </span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{c.label}</span>
        </div>
      ))}
    </div>
  );
}

function SessionRow({
  session,
  onShowResults,
}: {
  session: SessionInfo;
  onShowResults?: () => void;
}) {
  const tz = useTimeZone();
  return (
    <div className="flex items-center gap-2.5 py-1.5 text-sm">
      <span className="min-w-0 flex-1 truncate font-bold text-zinc-300">
        {SESSION_LABELS[session.code] ?? session.name}
        <span className="ml-2 text-xs font-normal text-zinc-600">{localDay(session.date, tz)}</span>
      </span>
      {onShowResults && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShowResults();
          }}
          className="shrink-0 rounded border border-edge px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 transition-colors hover:border-f1red hover:text-white"
        >
          Resultados
        </button>
      )}
      <span
        className="flex shrink-0 items-center gap-1 whitespace-nowrap font-mono text-xs text-zinc-500"
        title="Hora local del circuito"
      >
        <Flag size={11} /> {circuitTime(session.date_local)}
      </span>
      <span
        className="flex shrink-0 items-center gap-1 whitespace-nowrap font-mono font-bold text-zinc-200"
        title={`Tu hora local (${tz})`}
      >
        <span className="rounded-sm border border-edge bg-white/5 px-1 py-px text-[9px] font-bold tracking-wider text-zinc-500">
          {tzShortLabel(tz, utcDate(session.date) ?? new Date(0))}
        </span>
        {localTime(session.date, tz)}
      </span>
    </div>
  );
}

function RaceCard({
  ev,
  status,
  expanded,
  onToggle,
  onShowResults,
}: {
  ev: EventInfo;
  status: "past" | "next" | "future";
  expanded: boolean;
  onToggle: () => void;
  onShowResults: (session: SessionInfo) => void;
}) {
  const tz = useTimeZone();
  return (
    <div
      className={`race-card panel panel-glow group relative cursor-pointer overflow-hidden transition-opacity
        ${status === "past" ? "opacity-50 hover:opacity-90" : ""}
        ${status === "next" ? "border-f1red/60 shadow-lg shadow-f1red/15" : ""}`}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <span className="pointer-events-none absolute -right-3 -top-6 select-none text-[88px] font-black italic leading-none text-white/[0.04]">
        {String(ev.round).padStart(2, "0")}
      </span>
      <MiniTrack
        location={ev.location}
        size={92}
        className="absolute right-3 top-3 opacity-70 transition-opacity duration-300 group-hover:opacity-100"
      />

      <div className="relative p-5 pr-26">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500">
            Ronda {ev.round}
          </span>
          {status === "next" && (
            <span className="animate-pulse rounded bg-f1red px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
              Próxima
            </span>
          )}
          {status === "past" && <CheckCircle2 size={14} className="text-zinc-600" />}
        </div>

        <h3 className="text-lg font-black uppercase italic leading-tight">{ev.name}</h3>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
          <MapPin size={12} />
          {ev.location}, {ev.country}
          <span className="ml-auto font-mono">{eventDateRange(ev, tz)}</span>
        </p>

        <div className="mt-2 flex items-center justify-between">
          {ev.format !== "conventional" && (
            <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
              Sprint
            </span>
          )}
          <ChevronDown
            size={16}
            className={`ml-auto text-zinc-600 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </div>

      {/* Fuera del contenedor con pr-26: la mini-pista queda arriba y aquí
          las filas de sesiones necesitan el ancho completo de la tarjeta */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mx-5 mb-4 divide-y divide-edge/60 border-t border-edge pt-2">
              {ev.sessions.map((s) => {
                const past = utcDate(s.date) != null && utcDate(s.date)!.getTime() < Date.now();
                return (
                  <SessionRow
                    key={s.code}
                    session={s}
                    onShowResults={past ? () => onShowResults(s) : undefined}
                  />
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function CalendarView() {
  const { year } = useSessionStore();
  const tz = useTimeZone();
  const { data: events, isLoading } = useEvents();
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [resultsTarget, setResultsTarget] = useState<ResultsTarget | null>(null);
  const [calSubTab, setCalSubTab] = useState<CalSubTab>("races");

  const nextRace = useMemo(
    () => events?.find((ev) => (raceDate(ev)?.getTime() ?? 0) > Date.now()) ?? null,
    [events],
  );

  useGSAP(
    () => {
      if (events?.length) {
        gsap.from(".race-card", {
          opacity: 0,
          y: 30,
          scale: 0.96,
          duration: 0.55,
          stagger: 0.04,
          ease: "power3.out",
          clearProps: "opacity,transform",
        });
        gsap.from(".calendar-hero", {
          opacity: 0,
          y: -20,
          duration: 0.7,
          ease: "power3.out",
          clearProps: "opacity,transform",
        });
      }
    },
    { dependencies: [events], scope: ref },
  );

  if (calSubTab === "drivers") {
    return (
      <div className="space-y-6">
        <CalSubNav active={calSubTab} onChange={setCalSubTab} />
        <DriversChampionship />
      </div>
    );
  }

  if (calSubTab === "constructors") {
    return (
      <div className="space-y-6">
        <CalSubNav active={calSubTab} onChange={setCalSubTab} />
        <ConstructorsChampionship />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-5">
        <ChartSkeleton height={220} />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ChartSkeleton key={i} height={140} />
          ))}
        </div>
      </div>
    );
  }
  if (!events?.length) {
    return <EmptyState message={`No hay calendario disponible para ${year}`} />;
  }

  const nextRaceDate = nextRace ? raceDate(nextRace) : null;

  return (
    <div ref={ref} className="space-y-6">
      <CalSubNav active={calSubTab} onChange={setCalSubTab} />
      {nextRace && nextRaceDate ? (
        <div className="calendar-hero panel relative overflow-hidden p-8">
          {/* Acento de marca: barra roja sólida a la izquierda */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-f1red" />
          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.3em] text-red-400">
                Próximo Gran Premio · Ronda {nextRace.round}
              </p>
              <h2 className="font-wide text-4xl uppercase leading-none">
                {nextRace.name}
              </h2>
              <p className="mt-2 flex items-center gap-1.5 text-sm text-zinc-400">
                <MapPin size={14} />
                {nextRace.location}, {nextRace.country}
                <span className="ml-3 font-mono text-zinc-500">
                  Carrera:{" "}
                  {nextRaceDate.toLocaleString("es-ES", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: tz,
                  })}{" "}
                  ({tzShortLabel(tz, nextRaceDate)})
                </span>
              </p>
            </div>
            <div className="flex items-center gap-8">
              <MiniTrack location={nextRace.location} size={130} className="hidden opacity-80 md:block" />
              <Countdown target={nextRaceDate} />
            </div>
          </div>
        </div>
      ) : (
        <div className="calendar-hero panel p-6 text-center text-sm text-zinc-500">
          Temporada {year} finalizada — selecciona otra temporada para ver su calendario.
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
        {events.map((ev) => {
          const rd = raceDate(ev)?.getTime() ?? 0;
          const status: "past" | "next" | "future" =
            ev.round === nextRace?.round ? "next" : rd < Date.now() ? "past" : "future";
          return (
            <RaceCard
              key={ev.round}
              ev={ev}
              status={status}
              expanded={expanded === ev.round}
              onToggle={() => setExpanded(expanded === ev.round ? null : ev.round)}
              onShowResults={(s) =>
                setResultsTarget({
                  year,
                  gp: ev.name,
                  session: s.code,
                  sessionName: SESSION_LABELS[s.code] ?? s.name,
                })
              }
            />
          );
        })}
      </div>

      <SessionResultsModal target={resultsTarget} onClose={() => setResultsTarget(null)} />
    </div>
  );
}
