"use client";

import { CalendarDays, ChevronLeft } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { LogoMark } from "@/components/LogoMark";
import { Button } from "@/components/ui/Button";
import { useEvents } from "@/hooks/useF1Data";
import { useSessionStore } from "@/store/sessionStore";

/** Cabecera flotante en cápsula de cristal, fija arriba. */
export function Header() {
  const { year, gp, session, tab, setTab } = useSessionStore(
    useShallow((s) => ({
      year: s.year,
      gp: s.gp,
      session: s.session,
      tab: s.tab,
      setTab: s.setTab,
    })),
  );
  const { data: events } = useEvents();
  const event = events?.find((e) => e.name === gp);
  const inCalendar = tab === "calendar";

  return (
    <header className="sticky top-0 z-30 px-3 pt-3 md:px-6">
      <div className="glass animate-rise mx-auto flex h-14 max-w-[1500px] items-center gap-3 rounded-full pl-3 pr-2 md:h-16 md:gap-4 md:pl-4">
        <div className="flex items-center gap-2.5">
          <LogoMark size={32} />
          <h1 className="font-wide text-lg uppercase leading-none tracking-wider md:text-xl">
            Delta<span className="text-f1red">Zero</span>
          </h1>
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-2 pr-1 text-sm md:pr-0">
          {gp && !inCalendar && (
            <nav aria-label="Sesión actual" className="hidden min-w-0 items-center gap-1 sm:flex">
              <span className="fill-control rounded-full px-3 py-1.5 font-semibold tabular-nums">
                {year}
              </span>
              <span className="fill-control truncate rounded-full px-3 py-1.5 font-semibold">
                {event?.country ?? gp}
              </span>
              {session && (
                <span className="rounded-full bg-f1red/15 px-3 py-1.5 font-bold text-red-300 shadow-[inset_0_0_0_1px_rgb(225_6_0/0.35)]">
                  {session}
                </span>
              )}
            </nav>
          )}

          {/* En móvil la temporada está en la barra inferior */}
          <div className="hidden md:block">
            <Button
              variant={inCalendar ? "primary" : "secondary"}
              className="uppercase"
              onClick={() => setTab(inCalendar ? "telemetry" : "calendar")}
            >
              {inCalendar ? <ChevronLeft size={16} /> : <CalendarDays size={15} />}
              {inCalendar ? "Volver al análisis" : "Temporada"}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
