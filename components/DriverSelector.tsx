"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";

import { DriverAvatar } from "@/components/DriverAvatar";
import { DRIVER_PHOTOS } from "@/lib/champAssets";
import { useDrivers } from "@/hooks/useF1Data";
import { useSessionStore } from "@/store/sessionStore";

gsap.registerPlugin(useGSAP);

export function DriverSelector() {
  const ref = useRef<HTMLDivElement>(null);
  const { data: drivers, isLoading, isError } = useDrivers();
  const { selectedDrivers, toggleDriver, session } = useSessionStore();

  useGSAP(
    () => {
      if (drivers?.length) {
        gsap.from(".driver-chip", {
          opacity: 0,
          y: 16,
          scale: 0.9,
          duration: 0.45,
          stagger: 0.035,
          ease: "back.out(1.6)",
          clearProps: "opacity,transform",
        });
      }
    },
    { dependencies: [drivers], scope: ref },
  );

  if (!session) return null;

  if (isLoading) {
    return (
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
          Pilotos — cargando sesión (la primera vez tarda un poco)…
        </p>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="skeleton h-9 w-20" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return <p className="text-sm text-red-400">No se pudo cargar la sesión. Prueba con otra.</p>;
  }

  return (
    <div ref={ref}>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
        Pilotos <span className="text-zinc-600">(máx. 5 — {selectedDrivers.length} seleccionados)</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {drivers?.map((d) => {
          const active = selectedDrivers.includes(d.abbreviation);
          return (
            <button
              key={d.abbreviation}
              onClick={() => toggleDriver(d.abbreviation)}
              title={`${d.full_name} — ${d.team}`}
              style={
                active
                  ? { borderColor: d.team_color, boxShadow: `0 0 16px ${d.team_color}55`, background: `${d.team_color}22` }
                  : undefined
              }
              className={`driver-chip group flex items-center gap-2 rounded border px-3 py-1.5 text-sm font-bold transition-all duration-200
                ${active ? "scale-105 text-white" : "border-edge bg-panel text-zinc-400 hover:scale-105 hover:border-zinc-500 hover:text-white"}`}
            >
              <DriverAvatar url={DRIVER_PHOTOS[d.abbreviation] ?? d.headshot_url} color={d.team_color} size={40} alt={d.full_name} />
              {d.abbreviation}
              <span className="text-[10px] font-normal text-zinc-500">{d.number}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
