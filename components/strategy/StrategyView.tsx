"use client";

import { useMemo } from "react";

import { ChartPanel, ChartSkeleton, EmptyState } from "@/components/ChartPanel";
import { useResults, useStrategy } from "@/hooks/useF1Data";
import type { Stint } from "@/lib/types";
import { compoundColor, formatLapTime } from "@/lib/utils";
import { useSessionStore } from "@/store/sessionStore";

const COMPOUNDS = ["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"];

export function StrategyView() {
  const gp = useSessionStore((s) => s.gp);
  const selectedDrivers = useSessionStore((s) => s.selectedDrivers);
  const { data: stints, isLoading } = useStrategy();
  const { data: results } = useResults();

  // Stints agrupados por piloto y pilotos ordenados por resultado final
  const rows = useMemo(() => {
    if (!stints) return [];
    const byDriver = new Map<string, Stint[]>();
    for (const s of stints) {
      const arr = byDriver.get(s.driver);
      if (arr) arr.push(s);
      else byDriver.set(s.driver, [s]);
    }
    const order = new Map((results ?? []).map((r, i) => [r.driver, i]));
    return [...byDriver.entries()]
      .sort(([a], [b]) => (order.get(a) ?? 99) - (order.get(b) ?? 99))
      .map(([driver, list]) => ({ driver, stints: list }));
  }, [stints, results]);

  const maxLap = useMemo(() => Math.max(1, ...(stints?.map((s) => s.lap_end) ?? [1])), [stints]);
  const highlight = selectedDrivers.length > 0 ? new Set(selectedDrivers) : null;

  // Resumen: estrategia más usada (secuencia de compuestos) y nº de paradas
  const summary = useMemo(() => {
    if (!rows.length) return null;
    const plans = rows.map((r) => r.stints.map((s) => s.compound[0]).join("→"));
    const freq = new Map<string, number>();
    for (const p of plans) freq.set(p, (freq.get(p) ?? 0) + 1);
    const [top, count] = [...freq.entries()].sort((a, b) => b[1] - a[1])[0];
    const stops = rows.map((r) => r.stints.length - 1);
    const avgStops = stops.reduce((a, b) => a + b, 0) / stops.length;
    return { top, count, avgStops };
  }, [rows]);

  if (!gp) return <EmptyState message="Selecciona un Gran Premio" />;
  if (isLoading) return <ChartSkeleton height={520} />;
  if (!stints?.length) return <EmptyState message="No hay datos de estrategia para este GP" />;

  return (
    <div className="space-y-5">
      {summary && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat label="Estrategia más usada" value={summary.top} sub={`${summary.count} pilotos`} />
          <Stat label="Paradas de media" value={summary.avgStops.toFixed(1)} sub="por piloto" />
          <Stat
            label="Vueltas"
            value={String(maxLap)}
            sub="distancia de carrera"
            className="col-span-2 md:col-span-1"
          />
        </div>
      )}

      <ChartPanel title="Estrategia de neumáticos" subtitle="un stint por barra · ancho = vueltas">
        <div className="space-y-1.5">
          {rows.map(({ driver, stints: mine }, rowIdx) => {
            const dimmed = highlight && !highlight.has(driver);
            return (
              <div
                key={driver}
                className={`flex items-center gap-3 transition-opacity duration-300 ${dimmed ? "opacity-25" : ""}`}
              >
                <span className="w-10 shrink-0 text-right font-mono text-xs font-bold text-ink">
                  {driver}
                </span>
                <div className="relative h-7 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
                  {mine.map((s) => {
                    const left = ((s.lap_start - 1) / maxLap) * 100;
                    const width = ((s.lap_end - s.lap_start + 1) / maxLap) * 100;
                    const c = compoundColor(s.compound);
                    return (
                      <div
                        key={s.stint_number}
                        className="grow-x absolute bottom-[3px] top-[3px] flex items-center justify-center rounded-full"
                        style={
                          {
                            "--i": rowIdx,
                            left: `calc(${left}% + 1px)`,
                            width: `calc(${width}% - 3px)`,
                            background: `linear-gradient(180deg, ${c}, ${c}c8)`,
                            boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.35)",
                          } as React.CSSProperties
                        }
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
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3 text-[11px] text-ink-2">
            {COMPOUNDS.map((c) => (
              <span key={c} className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: compoundColor(c) }}
                />
                {c}
              </span>
            ))}
          </div>
          <span className="text-[11px] text-ink-3">vuelta 1 → {maxLap}</span>
        </div>
      </ChartPanel>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  className = "",
}: {
  label: string;
  value: string;
  sub: string;
  className?: string;
}) {
  return (
    <div className={`panel animate-rise px-5 py-4 ${className}`}>
      <p className="eyebrow">{label}</p>
      <p className="font-wide mt-1.5 text-2xl leading-none">{value}</p>
      <p className="mt-1 text-xs text-ink-3">{sub}</p>
    </div>
  );
}
