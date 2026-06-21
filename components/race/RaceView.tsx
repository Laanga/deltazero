"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartPanel, ChartSkeleton, EmptyState } from "@/components/ChartPanel";
import { DriverTag } from "@/components/DriverTag";
import { useGaps, usePositions, useRaceEvents, useResults, useStrategy } from "@/hooks/useF1Data";
import { api } from "@/lib/api";
import { AXIS, GRID, TOOLTIP as TOOLTIP_BASE } from "@/lib/chartDefaults";
import { useSessionStore } from "@/store/sessionStore";

// La parrilla completa cabe mucha gente: limita la altura del tooltip
const TOOLTIP = {
  ...TOOLTIP_BASE,
  contentStyle: { ...TOOLTIP_BASE.contentStyle, maxHeight: 320, overflow: "hidden" },
} as const;

const EVENT_COLORS: Record<string, string> = {
  SC: "#ffd12e",
  VSC: "#ff9d2e",
  RED: "#e10600",
};

const FIRST_DATA_YEAR = 2023; // OpenF1 no tiene telemetría/gaps antes de esto

export function RaceView() {
  const { year, gp, selectedDrivers } = useSessionStore();
  const { data: positions, isLoading: loadingPos } = usePositions();
  const { data: gaps, isLoading: loadingGaps } = useGaps();
  const { data: events } = useRaceEvents();
  const { data: results } = useResults();
  const { data: stints } = useStrategy();

  const [compareYear, setCompareYear] = useState<number | null>(null);

  // Gaps de la misma carrera en otra temporada, para superponer (comparte caché con useGaps)
  const compareGaps = useQuery({
    queryKey: ["gaps", compareYear, gp],
    queryFn: () => api.gaps(compareYear!, gp!),
    enabled: !!gp && compareYear != null,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  });

  const colorOf = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of results ?? []) map[r.driver] = r.team_color ?? "#888";
    return (driver: string) => map[driver] ?? "#888";
  }, [results]);

  const allDrivers = useMemo(() => {
    if (!positions?.length) return [];
    const set = new Set<string>();
    for (const p of positions) Object.keys(p.positions).forEach((d) => set.add(d));
    return [...set];
  }, [positions]);

  const highlight = selectedDrivers.length > 0 ? new Set(selectedDrivers) : null;

  const positionData = useMemo(
    () => positions?.map((p) => ({ lap: p.lap, ...p.positions })) ?? [],
    [positions],
  );
  const gapData = useMemo(
    () => gaps?.map((g) => ({ lap: g.lap, ...g.gaps })) ?? [],
    [gaps],
  );

  // Paradas por piloto = primera vuelta de cada stint posterior al primero
  const pitLapsByDriver = useMemo(() => {
    const map: Record<string, number[]> = {};
    for (const s of stints ?? []) {
      if (s.stint_number > 1) (map[s.driver] ??= []).push(s.lap_start);
    }
    return map;
  }, [stints]);

  // Ventana de paradas: rango donde se concentra el 80% central de las paradas
  const pitWindow = useMemo(() => {
    const all = Object.values(pitLapsByDriver).flat().sort((a, b) => a - b);
    if (all.length === 0) return null;
    if (all.length < 4) return { from: all[0], to: all[all.length - 1] };
    const q = (p: number) => all[Math.floor(p * (all.length - 1))];
    return { from: q(0.1), to: q(0.9) };
  }, [pitLapsByDriver]);

  // Marcadores de parada de los pilotos destacados
  const highlightedPits = useMemo(() => {
    if (!highlight) return [];
    const out: { driver: string; lap: number }[] = [];
    for (const d of selectedDrivers) {
      for (const lap of pitLapsByDriver[d] ?? []) out.push({ driver: d, lap });
    }
    return out;
  }, [highlight, selectedDrivers, pitLapsByDriver]);

  // Gap combinado con la temporada de comparación (solo pilotos seleccionados)
  const cmpByLap = useMemo(() => {
    const m = new Map<number, Record<string, number>>();
    for (const g of compareGaps.data ?? []) m.set(g.lap, g.gaps);
    return m;
  }, [compareGaps.data]);

  const mergedGapData = useMemo(() => {
    if (compareYear == null || cmpByLap.size === 0) return gapData;
    const laps = new Set<number>();
    for (const r of gapData) laps.add(r.lap as number);
    for (const l of cmpByLap.keys()) laps.add(l);
    const base = new Map(gapData.map((r) => [r.lap as number, r]));
    return [...laps].sort((a, b) => a - b).map((lap) => {
      const row: Record<string, number> = { ...(base.get(lap) ?? { lap }) };
      const cmp = cmpByLap.get(lap);
      if (cmp) for (const d of selectedDrivers) if (cmp[d] != null) row[`${d} ${compareYear}`] = cmp[d];
      return row;
    });
  }, [gapData, cmpByLap, compareYear, selectedDrivers]);

  // Rangos consecutivos de SC/VSC/RED para pintar bandas
  const eventBands = useMemo(() => {
    if (!events) return [];
    const bands: { from: number; to: number; type: string }[] = [];
    for (const e of events) {
      const type = e.events.includes("RED") ? "RED" : e.events.includes("SC") ? "SC" : "VSC";
      const last = bands[bands.length - 1];
      if (last && last.type === type && last.to === e.lap - 1) last.to = e.lap;
      else bands.push({ from: e.lap, to: e.lap, type });
    }
    return bands;
  }, [events]);

  const compareOptions = useMemo(() => {
    const out: number[] = [];
    for (let y = year - 1; y >= FIRST_DATA_YEAR; y--) out.push(y);
    return out;
  }, [year]);

  if (!gp) return <EmptyState message="Selecciona un Gran Premio" />;
  if (loadingPos || loadingGaps) {
    return (
      <div className="space-y-5">
        <ChartSkeleton height={400} />
        <ChartSkeleton height={300} />
      </div>
    );
  }
  if (!positions?.length) {
    return (
      <EmptyState
        message="Aún no hay datos de carrera para este Gran Premio"
        hint="Los datos oficiales de posición pueden tardar unos minutos en publicarse tras la sesión. Si la carrera ya terminó hace tiempo, prueba con otro Gran Premio."
      />
    );
  }

  const lineProps = (driver: string) => ({
    stroke: colorOf(driver),
    strokeWidth: highlight ? (highlight.has(driver) ? 2.6 : 1) : 1.8,
    strokeOpacity: highlight ? (highlight.has(driver) ? 1 : 0.18) : 0.9,
    dot: false as const,
    animationDuration: 1100,
  });

  const matrixCsv = (rows: Record<string, number | undefined>[]) => (): (string | number | null)[][] => {
    const header = ["vuelta", ...allDrivers];
    const out = rows.map((r) => [r.lap ?? "", ...allDrivers.map((d) => r[d] ?? "")]);
    return [header, ...out];
  };

  return (
    <div className="space-y-5">
      <ChartPanel
        title="Posiciones por vuelta"
        subtitle="bandas: amarillo SC · naranja VSC · rojo bandera roja · gris ventana de paradas"
        exportName="posiciones"
        csvRows={matrixCsv(positionData)}
      >
        <ResponsiveContainer width="100%" height={440}>
          <LineChart data={positionData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="lap" {...AXIS} />
            <YAxis {...AXIS} reversed domain={[1, allDrivers.length]} tickCount={allDrivers.length} allowDecimals={false} />
            <Tooltip {...TOOLTIP} labelFormatter={(v) => `Vuelta ${v}`} itemSorter={(item) => item.value as number} />
            {pitWindow && (
              <ReferenceArea x1={pitWindow.from} x2={pitWindow.to} fill="#a1a1aa" fillOpacity={0.06} />
            )}
            {eventBands.map((b, i) => (
              <ReferenceArea key={i} x1={b.from} x2={b.to} fill={EVENT_COLORS[b.type]} fillOpacity={0.08} />
            ))}
            {highlightedPits.map((p, i) => (
              <ReferenceLine
                key={`pit-${i}`}
                x={p.lap}
                stroke={colorOf(p.driver)}
                strokeDasharray="3 3"
                strokeOpacity={0.6}
              />
            ))}
            {allDrivers.map((d) => (
              <Line key={d} type="stepAfter" dataKey={d} {...lineProps(d)} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
        {highlightedPits.length > 0 && (
          <p className="mt-2 text-[11px] text-zinc-500">
            Líneas verticales punteadas = paradas de los pilotos seleccionados.
          </p>
        )}
      </ChartPanel>

      {/* Comparativa histórica */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
          Comparar gap con
        </span>
        <select
          value={compareYear ?? ""}
          onChange={(e) => setCompareYear(e.target.value ? Number(e.target.value) : null)}
          className="rounded border border-edge bg-panel px-3 py-1.5 text-sm font-semibold outline-none transition-colors hover:border-f1red/50"
        >
          <option value="">Sin comparar</option>
          {compareOptions.map((y) => (
            <option key={y} value={String(y)}>
              {gp} {y}
            </option>
          ))}
        </select>
        {compareYear != null && selectedDrivers.length === 0 && (
          <span className="text-xs text-zinc-500">Selecciona pilotos para superponer su gap</span>
        )}
        {compareYear != null && !compareGaps.isLoading && cmpByLap.size === 0 && (
          <span className="text-xs text-amber-500/80">No hay datos de {gp} en {compareYear}</span>
        )}
      </div>

      <ChartPanel
        title="Gap vs líder"
        subtitle={compareYear != null ? `línea punteada = ${compareYear}` : "segundos perdidos respecto al líder de cada vuelta"}
        exportName="gap-vs-lider"
        csvRows={matrixCsv(gapData)}
      >
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={mergedGapData} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="lap" {...AXIS} />
            <YAxis {...AXIS} tickFormatter={(v) => `${v}s`} />
            <Tooltip {...TOOLTIP} labelFormatter={(v) => `Vuelta ${v}`} formatter={(v) => `${(v as number).toFixed(1)}s`} itemSorter={(item) => item.value as number} />
            {eventBands.map((b, i) => (
              <ReferenceArea key={i} x1={b.from} x2={b.to} fill={EVENT_COLORS[b.type]} fillOpacity={0.08} />
            ))}
            {allDrivers.map((d) => (
              <Line key={d} type="monotone" dataKey={d} {...lineProps(d)} connectNulls />
            ))}
            {compareYear != null &&
              selectedDrivers.map((d) => (
                <Line
                  key={`cmp-${d}`}
                  type="monotone"
                  dataKey={`${d} ${compareYear}`}
                  stroke={colorOf(d)}
                  strokeWidth={2}
                  strokeOpacity={0.5}
                  strokeDasharray="5 4"
                  dot={false}
                  connectNulls
                  animationDuration={800}
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartPanel>

      {results && results.length > 0 && (
        <ChartPanel
          title="Resultado final"
          exportName="resultado-final"
          allowPng={false}
          csvRows={() => [
            ["pos", "piloto", "nombre", "equipo", "parrilla", "puntos", "estado"],
            ...results.map((r) => [
              r.position ?? "",
              r.driver,
              r.full_name,
              r.team,
              r.grid_position ?? "",
              r.points,
              r.status,
            ]),
          ]}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-edge text-left text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                  <th className="px-3 py-2">Pos</th>
                  <th className="px-3 py-2">Piloto</th>
                  <th className="px-3 py-2">Equipo</th>
                  <th className="px-3 py-2 text-right">Parrilla</th>
                  <th className="px-3 py-2 text-right">Puntos</th>
                  <th className="px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr
                    key={r.driver}
                    className={`border-b border-edge/40 transition-colors hover:bg-panel-light
                      ${highlight?.has(r.driver) ? "bg-f1red/10" : ""}`}
                  >
                    <td className="px-3 py-2 font-black">{r.position ?? "—"}</td>
                    <td className="px-3 py-2">
                      <DriverTag
                        code={r.driver}
                        fullName={r.full_name}
                        color={r.team_color ?? "#888"}
                        headshot={r.headshot_url}
                        size={30}
                      />
                    </td>
                    <td className="px-3 py-2 text-zinc-400">{r.team}</td>
                    <td className="px-3 py-2 text-right text-zinc-400">{r.grid_position ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-bold">{r.points > 0 ? `+${r.points}` : "0"}</td>
                    <td className="px-3 py-2 text-xs text-zinc-500">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartPanel>
      )}
    </div>
  );
}
