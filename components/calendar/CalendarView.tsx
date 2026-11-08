"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, CheckCircle2, ChevronDown, Flag, MapPin, Trophy, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ChartSkeleton, EmptyState } from "@/components/ChartPanel";
import { ConstructorsChampionship } from "@/components/championship/ConstructorsChampionship";
import { DriversChampionship } from "@/components/championship/DriversChampionship";
import { MiniTrack } from "@/components/calendar/MiniTrack";
import { SessionResultsModal, type ResultsTarget } from "@/components/calendar/SessionResultsModal";
import { useEvents } from "@/hooks/useF1Data";
import { useTimeZone, tzShortLabel } from "@/hooks/useTimeZone";
import type { EventInfo, SessionInfo } from "@/lib/types";
import { Badge } from "@/components/ui/Chip";
import { SegmentedControl, type Segment } from "@/components/ui/SegmentedControl";
import { useSessionStore } from "@/store/sessionStore";

type CalSubTab = "races" | "drivers" | "constructors";

const SUB_TABS: Segment<CalSubTab>[] = [
  { id: "races", label: "Calendario", icon: <CalendarDays size={15} /> },
  { id: "drivers", label: "Pilotos", icon: <Users size={15} /> },
  { id: "constructors", label: "Constructores", icon: <Trophy size={15} /> },
];

function CalSubNav({ active, onChange }: { active: CalSubTab; onChange: (t: CalSubTab) => void }) {
  return (
    <SegmentedControl
      ariaLabel="Secciones de la temporada"
      segments={SUB_TABS}
      value={active}
      onChange={onChange}
      className="max-md:w-full max-md:[&>button]:flex-1 max-md:[&>button]:justify-center max-md:[&>button]:px-2 max-md:[&_svg]:hidden"
    />
  );
}

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
    <div className="flex gap-2 md:gap-3" role="timer" aria-label="Cuenta atrás para la carrera">
      {cells.map((c) => (
        <div
          key={c.label}
          className="glass flex w-16 flex-col items-center rounded-[20px] px-2 py-2.5 md:w-19"
        >
          <span className="font-mono text-2xl font-black tabular-nums md:text-3xl">
            {String(c.value).padStart(2, "0")}
          </span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-ink-3">{c.label}</span>
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
      <span className="min-w-0 flex-1 truncate font-bold text-ink">
        {SESSION_LABELS[session.code] ?? session.name}
        <span className="ml-2 text-xs font-normal text-ink-3">{localDay(session.date, tz)}</span>
      </span>
      {onShowResults && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShowResults();
          }}
          className="pressable shrink-0 rounded-full bg-f1red/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-red-300 hover:bg-f1red/30 hover:text-white"
        >
          Resultados
        </button>
      )}
      <span
        className="hidden shrink-0 items-center gap-1 whitespace-nowrap font-mono text-xs text-ink-3 sm:flex"
        title="Hora local del circuito"
      >
        <Flag size={11} /> {circuitTime(session.date_local)}
      </span>
      <span
        className="flex shrink-0 items-center gap-1 whitespace-nowrap font-mono font-bold text-ink"
        title={`Tu hora local (${tz})`}
      >
        <Badge>{tzShortLabel(tz, utcDate(session.date) ?? new Date(0))}</Badge>
        {localTime(session.date, tz)}
      </span>
    </div>
  );
}

function RaceCard({
  ev,
  now,
  index,
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
  index: number;
  now: number;
}) {
  const tz = useTimeZone();
  return (
    <div
      style={{ "--i": index } as React.CSSProperties}
      className={`stagger panel panel-glow group relative cursor-pointer overflow-hidden
        ${status === "past" ? "opacity-55 hover:opacity-95" : ""}
        ${status === "next" ? "!border-f1red/50 shadow-[0_0_0_1px_rgb(225_6_0/0.25),0_20px_50px_-20px_rgb(225_6_0/0.5)]" : ""}`}
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
          <span className="eyebrow">Ronda {ev.round}</span>
          {status === "next" && (
            <span className="rounded-full bg-f1red px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-[0_0_16px_rgb(225_6_0/0.6)]">
              Próxima
            </span>
          )}
          {status === "past" && <CheckCircle2 size={14} className="text-ink-3" />}
        </div>

        <h3 className="text-lg font-black uppercase leading-tight">{ev.name}</h3>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-3">
          <MapPin size={12} />
          {ev.location}, {ev.country}
          <span className="ml-auto font-mono">{eventDateRange(ev, tz)}</span>
        </p>

        <div className="mt-2 flex items-center justify-between">
          {ev.format !== "conventional" && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
              Sprint
            </span>
          )}
          <ChevronDown
            size={16}
            className={`ml-auto text-ink-3 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
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
            transition={{ type: "spring", stiffness: 420, damping: 40 }}
            className="overflow-hidden"
          >
            <div className="mx-3 mb-3 divide-y divide-white/[0.06] rounded-[20px] bg-white/[0.035] px-3 py-1">
              {ev.sessions.map((s) => {
                const past = (utcDate(s.date)?.getTime() ?? Infinity) < now;
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
  const year = useSessionStore((s) => s.year);
  const tz = useTimeZone();
  const { data: events, isLoading } = useEvents();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [resultsTarget, setResultsTarget] = useState<ResultsTarget | null>(null);
  const [calSubTab, setCalSubTab] = useState<CalSubTab>("races");
  // Instante de referencia fijado al montar (render puro; la cuenta atrás lleva su propio reloj)
  const [now] = useState(() => Date.now());

  const nextRace = useMemo(
    () => events?.find((ev) => (raceDate(ev)?.getTime() ?? 0) > now) ?? null,
    [events, now],
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
    <div className="space-y-6">
      <CalSubNav active={calSubTab} onChange={setCalSubTab} />
      {nextRace && nextRaceDate ? (
        <div className="panel animate-rise relative overflow-hidden p-6 md:p-8">
          {/* Halo de marca */}
          <div
            className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full"
            style={{ background: "radial-gradient(circle, rgb(225 6 0 / 0.25), transparent 65%)" }}
          />
          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.3em] text-f1red-bright">
                Próximo Gran Premio · Ronda {nextRace.round}
              </p>
              <h2 className="font-wide text-3xl uppercase leading-none md:text-4xl">
                {nextRace.name}
              </h2>
              <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-ink-2">
                <MapPin size={14} />
                {nextRace.location}, {nextRace.country}
                <span className="font-mono text-ink-3 md:ml-3">
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
              <MiniTrack
                location={nextRace.location}
                size={130}
                className="hidden opacity-80 md:block"
              />
              <Countdown target={nextRaceDate} />
            </div>
          </div>
        </div>
      ) : (
        <div className="panel p-6 text-center text-sm text-ink-3">
          Temporada {year} finalizada — selecciona otra temporada para ver su calendario.
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
        {events.map((ev) => {
          const rd = raceDate(ev)?.getTime() ?? 0;
          const status: "past" | "next" | "future" =
            ev.round === nextRace?.round ? "next" : rd < now ? "past" : "future";
          return (
            <RaceCard
              key={ev.round}
              index={ev.round}
              now={now}
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
