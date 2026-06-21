"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { CalendarDays } from "lucide-react";
import { useRef } from "react";

import { LogoMark } from "@/components/LogoMark";
import { useEvents } from "@/hooks/useF1Data";
import { useSessionStore } from "@/store/sessionStore";

gsap.registerPlugin(useGSAP);

export function Header() {
  const ref = useRef<HTMLElement>(null);
  const { year, gp, session, tab, setTab } = useSessionStore();
  const { data: events } = useEvents();
  const event = events?.find((e) => e.name === gp);
  const inCalendar = tab === "calendar";

  useGSAP(
    () => {
      gsap.from(".header-item", {
        y: -24,
        opacity: 0,
        duration: 0.7,
        stagger: 0.12,
        ease: "power3.out",
        clearProps: "opacity,transform",
      });
    },
    { scope: ref },
  );

  return (
    <header ref={ref} className="relative overflow-hidden border-b border-edge bg-panel/60 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1500px] items-center gap-6 px-6 py-4">
        <div className="header-item flex items-center gap-3">
          <LogoMark size={40} />
          <div>
            <h1 className="font-wide text-xl uppercase tracking-wider leading-none">
              Delta<span className="text-f1red">Zero</span>
            </h1>
          </div>
        </div>

        <div className="header-item ml-auto flex items-center gap-3 text-sm">
          {gp && !inCalendar && (
            <>
              <span className="rounded-md bg-panel-light border border-edge px-3 py-1.5 font-semibold">
                {year}
              </span>
              <span className="text-zinc-600">/</span>
              <span className="rounded-md bg-panel-light border border-edge px-3 py-1.5 font-semibold">
                {event?.country ?? gp}
              </span>
              {session && (
                <>
                  <span className="text-zinc-600">/</span>
                  <span className="rounded-md bg-f1red/15 border border-f1red/40 px-3 py-1.5 font-bold text-red-400">
                    {session}
                  </span>
                </>
              )}
            </>
          )}

          <button
            onClick={() => setTab(inCalendar ? "telemetry" : "calendar")}
            className={`ml-2 flex items-center gap-2 rounded-md border px-4 py-1.5 font-bold uppercase tracking-wide transition-colors
              ${inCalendar
                ? "border-f1red bg-f1red text-white"
                : "border-edge bg-panel-light text-zinc-300 hover:border-f1red hover:text-white"}`}
          >
            <CalendarDays size={15} />
            {inCalendar ? "Volver al análisis" : "Temporada"}
          </button>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 h-0.5 w-full bg-f1red" />
    </header>
  );
}
