"use client";

import { Check, X } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { DriverAvatar } from "@/components/DriverAvatar";
import { useDrivers } from "@/hooks/useF1Data";
import { DRIVER_PHOTOS } from "@/lib/champAssets";
import { MAX_DRIVERS, useSessionStore } from "@/store/sessionStore";

export function DriverSelector() {
  const { data: drivers, isLoading, isError } = useDrivers();
  const { selectedDrivers, toggleDriver, clearDrivers, session } = useSessionStore(
    useShallow((s) => ({
      selectedDrivers: s.selectedDrivers,
      toggleDriver: s.toggleDriver,
      clearDrivers: s.clearDrivers,
      session: s.session,
    })),
  );

  if (!session) return null;

  if (isLoading) {
    return (
      <div className="space-y-2.5">
        <p className="eyebrow pl-3">Pilotos — cargando sesión…</p>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="skeleton h-10 w-24 !rounded-full" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <p className="pl-3 text-sm text-red-300">No se pudo cargar la sesión. Prueba con otra.</p>
    );
  }

  const full = selectedDrivers.length >= MAX_DRIVERS;

  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2 pl-3">
        <p className="eyebrow">
          Pilotos{" "}
          <span className="text-ink-3/70 normal-case tracking-normal">
            · {selectedDrivers.length}/{MAX_DRIVERS}
          </span>
        </p>
        {selectedDrivers.length > 0 && (
          <button
            type="button"
            onClick={clearDrivers}
            className="pressable ml-auto flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-ink-3 hover:bg-white/[0.07] hover:text-ink"
          >
            <X size={12} /> Limpiar
          </button>
        )}
      </div>
      <div
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] md:flex-wrap md:overflow-visible"
        role="group"
        aria-label="Selección de pilotos"
      >
        {drivers?.map((d, i) => {
          const active = selectedDrivers.includes(d.abbreviation);
          const blocked = full && !active;
          return (
            <button
              key={d.abbreviation}
              type="button"
              aria-pressed={active}
              disabled={blocked}
              onClick={() => toggleDriver(d.abbreviation)}
              title={`${d.full_name} — ${d.team}`}
              style={
                {
                  "--i": i,
                  ...(active
                    ? {
                        background: `linear-gradient(180deg, ${d.team_color}40, ${d.team_color}1c)`,
                        boxShadow: `inset 0 0 0 1.5px ${d.team_color}, 0 8px 22px -10px ${d.team_color}`,
                      }
                    : {}),
                } as React.CSSProperties
              }
              className={`stagger pressable group flex h-10 shrink-0 items-center gap-2 rounded-full pl-1 pr-3.5 text-sm font-bold
                ${active ? "text-white" : "fill-control text-ink-2 hover:bg-white/10 hover:text-white"}
                ${blocked ? "opacity-35" : ""}`}
            >
              <DriverAvatar
                url={DRIVER_PHOTOS[d.abbreviation] ?? d.headshot_url}
                color={d.team_color}
                size={32}
                alt={d.full_name}
              />
              {d.abbreviation}
              {active ? (
                <Check size={13} strokeWidth={3} style={{ color: d.team_color }} />
              ) : (
                <span className="text-[10px] font-normal tabular-nums text-ink-3">{d.number}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
