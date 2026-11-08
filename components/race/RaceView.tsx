"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartPanel, ChartSkeleton, EmptyState } from "@/components/ChartPanel";
import { DriverTag } from "@/components/DriverTag";
import { useGaps, usePositions, useRaceEvents, useResults, useStrategy } from "@/hooks/useF1Data";
import { api } from "@/lib/api";
import { EVENT_COLORS, PositionsChart, type LineStyle } from "@/components/race/PositionsChart";
import { Dropdown } from "@/components/ui/Dropdown";
import { AXIS, GRID } from "@/lib/chartDefaults";
import { useSessionStore } from "@/store/sessionStore";

const FIRST_DATA_YEAR = 2023; // OpenF1 no tiene telemetría/gaps antes de esto

export function RaceView() {
  const year = useSessionStore((s) => s.year);
  const gp = useSessionStore((s) => s.gp);
  const selectedDrivers = useSessionStore((s) => s.selectedDrivers);
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

  // Pilotos destacados: los seleccionados en la app, salvo que se cambien aquí con los chips
  const [focusOverride, setFocusOverride] = useState<string[] | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const focusList = focusOverride ?? selectedDrivers;
  const emphasized = useMemo(() => new Set(focusList), [focusList]);
  const highlight = emphasized.size > 0 ? emphasized : null;
  const toggleFocus = useCallback(
    (d: string) =>
      setFocusOverride((cur) => {
        const base = cur ?? selectedDrivers;
        return base.includes(d) ? base.filter((x) => x !== d) : [...base, d];
      }),
    [selectedDrivers],
  );

  // Orden de los pilotos: resultado final (o el de la última vuelta)
  const orderedDrivers = useMemo(() => {
    const order = new Map((results ?? []).map((r, i) => [r.driver, i]));
    const lastPos = positions?.[positions.length - 1]?.positions ?? {};
    return [...allDrivers].sort(
      (a, b) =>
        (order.get(a) ?? 50 + (lastPos[a] ?? 99)) - (order.get(b) ?? 50 + (lastPos[b] ?? 99)),
    );
  }, [allDrivers, results, positions]);

  // Compañeros de equipo comparten color: el segundo de cada equipo va discontinuo
  const dashed = useMemo(() => {
    const seen = new Set<string>();
    const out = new Set<string>();
    for (const d of orderedDrivers) {
      const c = colorOf(d).toLowerCase();
      if (seen.has(c)) out.add(d);
      else seen.add(c);
    }
    return out;
  }, [orderedDrivers, colorOf]);

  const styleOf = useCallback(
    (d: string): LineStyle => {
      const base = { stroke: colorOf(d), strokeDasharray: dashed.has(d) ? "5 3" : undefined };
      if (hovered)
        return {
          ...base,
          strokeWidth: d === hovered ? 3.2 : 1,
          strokeOpacity: d === hovered ? 1 : 0.12,
        };
      if (emphasized.size) {
        return {
          ...base,
          strokeWidth: emphasized.has(d) ? 2.6 : 1,
          strokeOpacity: emphasized.has(d) ? 1 : 0.14,
        };
      }
      return { ...base, strokeWidth: 1.6, strokeOpacity: 0.85 };
    },
    [colorOf, dashed, hovered, emphasized],
  );

  // Cada fila lleva la clasificación de la vuelta anterior (▲▼ en el tooltip)
  const positionData = useMemo(
    () =>
      positions?.map((p, i) => ({
        lap: p.lap,
        ...p.positions,
        __prev: (i > 0 ? positions[i - 1].positions : undefined) as unknown as number,
      })) ?? [],
    [positions],
  );
  const gapData = useMemo(() => gaps?.map((g) => ({ lap: g.lap, ...g.gaps })) ?? [], [gaps]);

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
    const all = Object.values(pitLapsByDriver)
      .flat()
      .sort((a, b) => a - b);
    if (all.length === 0) return null;
    if (all.length < 4) return { from: all[0], to: all[all.length - 1] };
    const q = (p: number) => all[Math.floor(p * (all.length - 1))];
    return { from: q(0.1), to: q(0.9) };
  }, [pitLapsByDriver]);

  // Paradas de los pilotos destacados (o del que está bajo el ratón)
  const highlightedPits = useMemo(() => {
    const who = hovered ? [hovered] : focusList;
    const out: { driver: string; lap: number }[] = [];
    for (const d of who) for (const lap of pitLapsByDriver[d] ?? []) out.push({ driver: d, lap });
    return out;
  }, [hovered, focusList, pitLapsByDriver]);

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
    return [...laps]
      .sort((a, b) => a - b)
      .map((lap) => {
        const row: Record<string, number> = { ...(base.get(lap) ?? { lap }) };
        const cmp = cmpByLap.get(lap);
        if (cmp) for (const d of focusList) if (cmp[d] != null) row[`${d} ${compareYear}`] = cmp[d];
        return row;
      });
  }, [gapData, cmpByLap, compareYear, focusList]);

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

  const matrixCsv =
    (rows: Record<string, number | undefined>[]) => (): (string | number | null)[][] => {
      const header = ["vuelta", ...allDrivers];
      const out = rows.map((r) => [r.lap ?? "", ...allDrivers.map((d) => r[d] ?? "")]);
      return [header, ...out];
    };

  return (
    <div className="space-y-5">
      <ChartPanel
        title="Posiciones por vuelta"
        subtitle="toca un piloto para destacarlo · ● = parada"
        exportName="posiciones"
        csvRows={matrixCsv(positionData)}
      >
        <FocusBar
          drivers={orderedDrivers}
          colorOf={colorOf}
          emphasized={emphasized}
          onToggle={toggleFocus}
          onHover={setHovered}
          onClear={() => setFocusOverride([])}
        />
        <PositionsChart
          data={positionData}
          drivers={orderedDrivers}
          styleOf={styleOf}
          colorOf={colorOf}
          emphasized={emphasized}
          bands={eventBands}
          pitWindow={pitWindow}
          pits={highlightedPits}
          onToggle={toggleFocus}
          onHover={setHovered}
          height={460}
        />
        <Legend bands={eventBands} pitWindow={!!pitWindow} />
      </ChartPanel>

      {/* Comparativa histórica */}
      <div className="flex flex-wrap items-center gap-2">
        <Dropdown
          compact
          label="Comparar gap con"
          value={compareYear != null ? `${gp} ${compareYear}` : "Sin comparar"}
          selectedKey={compareYear != null ? String(compareYear) : "none"}
          options={["none", ...compareOptions.map(String)]}
          display={(o) => ({ key: o, text: o === "none" ? "Sin comparar" : `${gp} ${o}` })}
          onSelect={(o) => setCompareYear(o === "none" ? null : Number(o))}
        />
        {compareYear != null && focusList.length === 0 && (
          <span className="text-xs text-ink-3">Destaca pilotos para superponer su gap</span>
        )}
        {compareYear != null && !compareGaps.isLoading && cmpByLap.size === 0 && (
          <span className="text-xs text-amber-500/80">
            No hay datos de {gp} en {compareYear}
          </span>
        )}
      </div>

      <ChartPanel
        title="Gap vs líder"
        subtitle={
          compareYear != null
            ? `línea punteada = ${compareYear}`
            : "segundos perdidos respecto al líder de cada vuelta"
        }
        exportName="gap-vs-lider"
        csvRows={matrixCsv(gapData)}
      >
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={mergedGapData} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="lap" {...AXIS} />
            <YAxis {...AXIS} tickFormatter={(v) => `${v}s`} />
            <Tooltip
              content={<GapTooltip colorOf={colorOf} emphasized={emphasized} />}
              cursor={{ stroke: "rgb(255 255 255 / 0.25)" }}
              isAnimationActive={false}
              wrapperStyle={{ zIndex: 50 }}
            />
            {eventBands.map((b, i) => (
              <ReferenceArea
                key={i}
                x1={b.from}
                x2={Math.max(b.to, b.from + 0.6)}
                fill={EVENT_COLORS[b.type]}
                fillOpacity={0.1}
              />
            ))}
            {orderedDrivers.map((d) => (
              <Line
                key={d}
                type="monotone"
                dataKey={d}
                {...styleOf(d)}
                dot={false}
                activeDot={
                  emphasized.size === 0 || emphasized.has(d) ? { r: 3, strokeWidth: 0 } : false
                }
                isAnimationActive={false}
                connectNulls
              />
            ))}
            {compareYear != null &&
              focusList.map((d) => (
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
            <table className="w-full border-separate border-spacing-y-1 text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-[0.15em] text-ink-3">
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
                    className={`transition-colors [&>td:first-child]:rounded-l-full [&>td:last-child]:rounded-r-full
                      ${highlight?.has(r.driver) ? "bg-f1red/12" : "bg-white/[0.025] hover:bg-white/[0.06]"}`}
                  >
                    <td className="px-3 py-2 pl-4 font-black tabular-nums">{r.position ?? "—"}</td>
                    <td className="px-3 py-2">
                      <DriverTag
                        code={r.driver}
                        fullName={r.full_name}
                        color={r.team_color ?? "#888"}
                        headshot={r.headshot_url}
                        size={30}
                      />
                    </td>
                    <td className="px-3 py-2 text-ink-2">{r.team}</td>
                    <td className="px-3 py-2 text-right text-ink-2">{r.grid_position ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-bold">
                      {r.points > 0 ? `+${r.points}` : "0"}
                    </td>
                    <td className="px-3 py-2 pr-4 text-xs text-ink-3">{r.status}</td>
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

/** Chips para destacar pilotos en las gráficas de carrera (orden de llegada). */
function FocusBar({
  drivers,
  colorOf,
  emphasized,
  onToggle,
  onHover,
  onClear,
}: {
  drivers: string[];
  colorOf: (d: string) => string;
  emphasized: Set<string>;
  onToggle: (d: string) => void;
  onHover: (d: string | null) => void;
  onClear: () => void;
}) {
  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-1.5"
      role="group"
      aria-label="Destacar pilotos"
    >
      {drivers.map((d, i) => {
        const on = emphasized.has(d);
        const c = colorOf(d);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(d)}
            onMouseEnter={() => onHover(d)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(d)}
            onBlur={() => onHover(null)}
            className={`pressable flex h-7 items-center gap-1.5 rounded-full pl-2 pr-2.5 text-[11px] font-bold tabular-nums ${on ? "text-white" : "fill-control text-ink-2 hover:text-white"}`}
            style={on ? { background: `${c}33`, boxShadow: `inset 0 0 0 1.5px ${c}` } : undefined}
          >
            <span className="text-[9px] font-semibold text-ink-3">{i + 1}</span>
            <span className="h-2 w-2 rounded-full" style={{ background: c }} />
            {d}
          </button>
        );
      })}
      {emphasized.size > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="pressable h-7 rounded-full px-2.5 text-[11px] font-semibold text-ink-3 hover:bg-white/[0.07] hover:text-ink"
        >
          Ver todos
        </button>
      )}
    </div>
  );
}

function Legend({ bands, pitWindow }: { bands: { type: string }[]; pitWindow: boolean }) {
  const types = [...new Set(bands.map((b) => b.type))];
  if (!types.length && !pitWindow) return null;
  const names: Record<string, string> = { SC: "Safety car", VSC: "VSC", RED: "Bandera roja" };
  return (
    <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-ink-3">
      {types.map((t) => (
        <span key={t} className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-4 rounded-full"
            style={{ background: EVENT_COLORS[t], opacity: 0.45 }}
          />
          {names[t] ?? t}
        </span>
      ))}
      {pitWindow && (
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-full bg-zinc-400/25" />
          Ventana de paradas
        </span>
      )}
    </div>
  );
}

function GapTooltip({
  active,
  label,
  payload,
  colorOf,
  emphasized,
}: {
  active?: boolean;
  label?: number | string;
  payload?: { dataKey?: string | number; value?: number }[];
  colorOf: (d: string) => string;
  emphasized: Set<string>;
}) {
  if (!active || !payload?.length) return null;
  const rows = payload
    .filter((p) => typeof p.value === "number" && !String(p.dataKey).includes(" "))
    .map((p) => ({ driver: String(p.dataKey), gap: p.value as number }))
    .sort((a, b) => a.gap - b.gap);
  const half = Math.ceil(rows.length / 2);
  return (
    <div className="menu-surface rounded-[16px] px-3 py-2.5 text-[11px]">
      <p className="mb-1.5 font-bold text-ink-2">Vuelta {label}</p>
      <div className="grid grid-cols-2 gap-x-4">
        {[rows.slice(0, half), rows.slice(half)].map((col, c) => (
          <div key={c} className="space-y-0.5">
            {col.map((r) => (
              <div
                key={r.driver}
                className={`flex items-center gap-1.5 ${emphasized.size === 0 || emphasized.has(r.driver) ? "" : "opacity-40"}`}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: colorOf(r.driver) }}
                />
                <span className="w-8 font-bold">{r.driver}</span>
                <span className="w-12 text-right font-mono tabular-nums text-ink-2">
                  {r.gap === 0 ? "líder" : `+${r.gap.toFixed(1)}s`}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
