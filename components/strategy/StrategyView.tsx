"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useMemo, useRef } from "react";

import { ChartPanel, ChartSkeleton, EmptyState } from "@/components/ChartPanel";
import { useResults, useStrategy } from "@/hooks/useF1Data";
import { compoundColor, formatLapTime } from "@/lib/utils";
import { useSessionStore } from "@/store/sessionStore";

gsap.registerPlugin(useGSAP);

export function StrategyView() {
  const { gp, selectedDrivers } = useSessionStore();
  const { data: stints, isLoading } = useStrategy();
  const { data: results } = useResults();
  const ref = useRef<HTMLDivElement>(null);

  // Pilotos ordenados por resultado final
  const driverOrder = useMemo(() => {
    if (!stints) return [];
    const order = (results ?? []).map((r) => r.driver);
    const present = [...new Set(stints.map((s) => s.driver))];
    return present.sort((a, b) => {
      const ia = order.indexOf(a), ib = order.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [stints, results]);

  const maxLap = useMemo(() => Math.max(1, ...(stints?.map((s) => s.lap_end) ?? [1])), [stints]);
  const highlight = selectedDrivers.length > 0 ? new Set(selectedDrivers) : null;

  useGSAP(
    () => {
      if (stints?.length) {
        gsap.from(".stint-bar", {
          scaleX: 0,
          transformOrigin: "left center",
          duration: 0.8,
          stagger: 0.012,
          ease: "power3.out",
          clearProps: "transform",
        });
        gsap.from(".stint-row-label", {
          opacity: 0,
          x: -16,
          duration: 0.5,
          stagger: 0.03,
          ease: "power2.out",
          clearProps: "opacity,transform",
        });
      }
    },
    { dependencies: [stints], scope: ref, revertOnUpdate: true },
  );

  if (!gp) return <EmptyState message="Selecciona un Gran Premio" />;
  if (isLoading) return <ChartSkeleton height={500} />;
  if (!stints?.length) return <EmptyState message="No hay datos de estrategia para este GP" />;

  return (
    <div ref={ref} className="space-y-5">
      <ChartPanel title="Estrategia de neumáticos" subtitle="un stint por barra · ancho = vueltas">
        <div className="space-y-1.5">
          {driverOrder.map((driver) => {
            const mine = stints.filter((s) => s.driver === driver);
            const dimmed = highlight && !highlight.has(driver);
            return (
              <div
                key={driver}
                className={`flex items-center gap-3 transition-opacity duration-300 ${dimmed ? "opacity-25" : ""}`}
              >
                <span className="stint-row-label w-10 shrink-0 text-right font-mono text-xs font-bold text-zinc-300">
                  {driver}
                </span>
                <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-panel">
                  {mine.map((s) => {
                    const left = ((s.lap_start - 1) / maxLap) * 100;
                    const width = ((s.lap_end - s.lap_start + 1) / maxLap) * 100;
                    return (
                      <div
                        key={s.stint_number}
                        className="stint-bar group absolute top-0.5 bottom-0.5 flex items-center justify-center rounded"
                        style={{
                          left: `${left}%`,
                          width: `calc(${width}% - 2px)`,
                          background: `${compoundColor(s.compound)}cc`,
                          boxShadow: `inset 0 0 0 1px ${compoundColor(s.compound)}`,
                        }}
                        title={`${s.compound} · vueltas ${s.lap_start}–${s.lap_end}${s.avg_lap_time ? ` · media ${formatLapTime(s.avg_lap_time)}` : ""}`}
                      >
                        <span className="text-[10px] font-black text-black/70">
                          {s.lap_end - s.lap_start + 1}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex flex-wrap gap-3 text-[11px] text-zinc-400">
            {["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"].map((c) => (
              <span key={c} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: compoundColor(c) }} />
                {c}
              </span>
            ))}
          </div>
          <span className="text-[11px] text-zinc-600">vuelta 1 → {maxLap}</span>
        </div>
      </ChartPanel>
    </div>
  );
}
