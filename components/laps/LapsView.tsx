"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import { ChartPanel, ChartSkeleton, EmptyState } from "@/components/ChartPanel";
import { useDrivers, useLaps, useRaceEvents } from "@/hooks/useF1Data";
import { AXIS, GRID, TOOLTIP } from "@/lib/chartDefaults";
import { compoundColor, formatLapTime, lineDashFor } from "@/lib/utils";
import { useSessionStore } from "@/store/sessionStore";

// Tope de delta (s) para el heatmap de degradación: a partir de aquí, rojo pleno.
const HEAT_CAP = 2;

/** Verde (rápido) → amarillo → rojo (lento) según el delta respecto a la mejor vuelta propia. */
function heatColor(delta: number) {
  const t = Math.min(1, Math.max(0, delta / HEAT_CAP));
  const hue = 140 - 140 * t;
  return `hsl(${hue}, 68%, 45%)`;
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors
        ${on ? "border-f1red bg-f1red/15 text-white" : "border-edge bg-panel text-zinc-500 hover:border-zinc-500 hover:text-zinc-300"}`}
    >
      {children}
    </button>
  );
}

export function LapsView() {
  const { selectedDrivers, session } = useSessionStore();
  const { data: drivers } = useDrivers();
  const { data: laps, isLoading } = useLaps();
  const { data: raceEvents } = useRaceEvents();

  const isRace = session === "R";
  const [excludePits, setExcludePits] = useState(true);
  const [excludeLap1, setExcludeLap1] = useState(false);
  const [excludeCaution, setExcludeCaution] = useState(false);

  const driverMeta = useMemo(
    () =>
      selectedDrivers.map((abbr) => ({
        abbr,
        team_color: drivers?.find((d) => d.abbreviation === abbr)?.team_color ?? "#888",
      })),
    [selectedDrivers, drivers],
  );

  // Vueltas con SC/VSC/bandera roja (solo tiene sentido en carrera)
  const cautionLaps = useMemo(() => {
    const set = new Set<number>();
    if (isRace) for (const e of raceEvents ?? []) set.add(e.lap);
    return set;
  }, [raceEvents, isRace]);

  // Vueltas válidas tras aplicar los filtros activos
  const filtered = useMemo(() => {
    if (!laps) return [];
    return laps.filter((l) => {
      if (l.lap_time == null) return false;
      if (excludePits && (l.pit_in || l.pit_out)) return false;
      if (excludeLap1 && l.lap_number === 1) return false;
      if (excludeCaution && cautionLaps.has(l.lap_number)) return false;
      return true;
    });
  }, [laps, excludePits, excludeLap1, excludeCaution, cautionLaps]);

  const maxLap = useMemo(() => filtered.reduce((m, l) => Math.max(m, l.lap_number), 0), [filtered]);

  // Línea de evolución: una columna por piloto
  const evolution = useMemo(() => {
    const byKey = new Map<string, number>();
    for (const l of filtered) byKey.set(`${l.driver}:${l.lap_number}`, l.lap_time!);
    const rows = [];
    for (let n = 1; n <= maxLap; n++) {
      const row: Record<string, number | null> = { lap: n };
      for (const d of selectedDrivers) row[d] = byKey.get(`${d}:${n}`) ?? null;
      rows.push(row);
    }
    return rows;
  }, [filtered, maxLap, selectedDrivers]);

  // Scatter con color de compuesto
  const scatterByDriver = useMemo(() => {
    const out: Record<string, { lap: number; time: number; compound: string | null; best: boolean }[]> = {};
    for (const l of filtered) {
      (out[l.driver] ??= []).push({
        lap: l.lap_number,
        time: l.lap_time!,
        compound: l.compound,
        best: l.is_personal_best,
      });
    }
    return out;
  }, [filtered]);

  // Heatmap de degradación: por piloto, delta de cada vuelta respecto a su mejor vuelta
  const heatRows = useMemo(() => {
    return selectedDrivers.map((d) => {
      const mine = filtered.filter((l) => l.driver === d);
      const times = new Map(mine.map((l) => [l.lap_number, l.lap_time!]));
      const ownBest = mine.length ? Math.min(...mine.map((l) => l.lap_time!)) : null;
      const color = driverMeta.find((m) => m.abbr === d)?.team_color ?? "#888";
      return { driver: d, color, times, ownBest };
    });
  }, [filtered, selectedDrivers, driverMeta]);

  // Mejores sectores por piloto (sobre todas las vueltas, sin filtrar)
  const sectorBests = useMemo(() => {
    if (!laps) return [];
    return selectedDrivers.map((d) => {
      const mine = laps.filter((l) => l.driver === d);
      const best = (key: "sector_1" | "sector_2" | "sector_3") => {
        const vals = mine.map((l) => l[key]).filter((v): v is number => v != null);
        return vals.length ? Math.min(...vals) : null;
      };
      return { driver: d, s1: best("sector_1"), s2: best("sector_2"), s3: best("sector_3") };
    });
  }, [laps, selectedDrivers]);

  if (selectedDrivers.length === 0) {
    return <EmptyState message="Selecciona pilotos para comparar sus tiempos de vuelta" />;
  }
  if (isLoading) {
    return (
      <div className="space-y-5">
        <ChartSkeleton height={320} />
        <ChartSkeleton height={220} />
      </div>
    );
  }

  const globalBest = {
    s1: Math.min(...sectorBests.map((s) => s.s1 ?? Infinity)),
    s2: Math.min(...sectorBests.map((s) => s.s2 ?? Infinity)),
    s3: Math.min(...sectorBests.map((s) => s.s3 ?? Infinity)),
  };

  const lapAxis = Array.from({ length: maxLap }, (_, i) => i + 1);

  // CSV: matriz vuelta × piloto con los tiempos filtrados
  const lapMatrixCsv = (): (string | number | null)[][] => {
    const header = ["vuelta", ...selectedDrivers];
    const rows = evolution.map((r) => [r.lap, ...selectedDrivers.map((d) => r[d] ?? "")]);
    return [header, ...rows];
  };

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Filtros</span>
        <Toggle on={excludePits} onClick={() => setExcludePits((v) => !v)}>
          Sin entradas/salidas de box
        </Toggle>
        <Toggle on={excludeLap1} onClick={() => setExcludeLap1((v) => !v)}>
          Sin vuelta 1
        </Toggle>
        {isRace && (
          <Toggle on={excludeCaution} onClick={() => setExcludeCaution((v) => !v)}>
            Sin SC/VSC
          </Toggle>
        )}
      </div>

      <ChartPanel
        title="Evolución de tiempos"
        subtitle={excludePits ? "vueltas de pit excluidas" : undefined}
        exportName="evolucion-tiempos"
        csvRows={lapMatrixCsv}
      >
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={evolution} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="lap" {...AXIS} label={{ value: "Vuelta", position: "insideBottom", offset: -2, fontSize: 11, fill: "#52525b" }} />
            <YAxis
              {...AXIS}
              width={68}
              domain={["auto", "auto"]}
              tickFormatter={(v) => formatLapTime(v)}
              reversed={false}
            />
            <Tooltip {...TOOLTIP} formatter={(v) => formatLapTime(v as number)} labelFormatter={(v) => `Vuelta ${v}`} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {driverMeta.map((d, i) => (
              <Line
                key={d.abbr}
                type="monotone"
                dataKey={d.abbr}
                stroke={d.team_color}
                strokeWidth={2}
                strokeDasharray={lineDashFor(i, driverMeta)}
                dot={{ r: 2.5, fill: d.team_color, strokeWidth: 0 }}
                animationDuration={900}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartPanel>

      <ChartPanel
        title="Degradación"
        subtitle="cada celda = delta de la vuelta respecto a la mejor del piloto"
        allowPng={false}
        exportName="degradacion"
        csvRows={lapMatrixCsv}
      >
        {maxLap === 0 ? (
          <div className="flex h-24 items-center justify-center text-sm text-zinc-600">
            No hay vueltas válidas con los filtros actuales
          </div>
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto pb-1">
              <div className="min-w-max space-y-1">
                <div className="flex items-center gap-0.5 pl-12">
                  {lapAxis.map((n) => (
                    <div key={n} className="w-3.5 text-center text-[8px] leading-none text-zinc-600">
                      {n % 5 === 0 ? n : ""}
                    </div>
                  ))}
                </div>
                {heatRows.map((r) => (
                  <div key={r.driver} className="flex items-center gap-0.5">
                    <span className="w-12 shrink-0 text-xs font-black" style={{ color: r.color }}>
                      {r.driver}
                    </span>
                    {lapAxis.map((n) => {
                      const t = r.times.get(n);
                      const delta = t != null && r.ownBest != null ? t - r.ownBest : null;
                      return (
                        <div
                          key={n}
                          title={t != null ? `V${n} · ${formatLapTime(t)} (+${(delta ?? 0).toFixed(3)}s)` : `V${n} · —`}
                          className="h-4 w-3.5 rounded-[2px]"
                          style={{
                            background: delta != null ? heatColor(delta) : "transparent",
                            border: delta == null ? "1px solid #26262f" : "none",
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              <span>mejor vuelta</span>
              <span
                className="h-2.5 w-32 rounded-full"
                style={{ background: `linear-gradient(90deg, ${heatColor(0)}, ${heatColor(HEAT_CAP / 2)}, ${heatColor(HEAT_CAP)})` }}
              />
              <span>+{HEAT_CAP}s o más</span>
            </div>
          </div>
        )}
      </ChartPanel>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartPanel
          title="Compuestos por vuelta"
          subtitle="color = neumático"
          exportName="compuestos"
        >
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="lap" name="Vuelta" {...AXIS} type="number" domain={["dataMin", "dataMax"]} />
              <YAxis dataKey="time" name="Tiempo" {...AXIS} width={68} domain={["auto", "auto"]} tickFormatter={(v) => formatLapTime(v)} />
              <ZAxis range={[28, 28]} />
              <Tooltip {...TOOLTIP} formatter={(v, name) => (name === "Tiempo" ? formatLapTime(v as number) : v)} />
              {Object.entries(scatterByDriver).map(([driver, points]) => (
                <Scatter
                  key={driver}
                  name={driver}
                  data={points}
                  fill="#888"
                  shape={(props: { cx?: number; cy?: number; payload?: { compound: string | null; best: boolean } }) => {
                    const { cx, cy, payload } = props;
                    if (cx == null || cy == null || !payload) return <g />;
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={payload.best ? 5 : 3.5}
                        fill={compoundColor(payload.compound)}
                        stroke={payload.best ? "#b026ff" : "none"}
                        strokeWidth={payload.best ? 2 : 0}
                        opacity={0.9}
                      />
                    );
                  }}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-zinc-400">
            {["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"].map((c) => (
              <span key={c} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: compoundColor(c) }} />
                {c}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border-2 border-purple-500" />
              personal best
            </span>
          </div>
        </ChartPanel>

        <ChartPanel title="Mejores sectores" subtitle="morado = mejor del grupo">
          <div className="space-y-4 pt-2">
            {sectorBests.map((s) => {
              const meta = driverMeta.find((d) => d.abbr === s.driver);
              return (
                <div key={s.driver}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta?.team_color }} />
                    <span className="text-sm font-bold">{s.driver}</span>
                  </div>
                  <div className="flex gap-2">
                    {([["S1", s.s1, globalBest.s1], ["S2", s.s2, globalBest.s2], ["S3", s.s3, globalBest.s3]] as const).map(
                      ([label, val, best]) => (
                        <div
                          key={label}
                          className={`flex-1 rounded-lg border px-3 py-2 text-center transition-all duration-300
                            ${val != null && val === best ? "border-purple-500/60 bg-purple-500/15 shadow-lg shadow-purple-500/10" : "border-edge bg-panel"}`}
                        >
                          <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
                          <p className={`font-mono text-sm font-bold ${val != null && val === best ? "text-purple-300" : ""}`}>
                            {val != null ? val.toFixed(3) : "—"}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ChartPanel>
      </div>
    </div>
  );
}
