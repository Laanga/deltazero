"use client";

import { memo, useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AXIS, GRID } from "@/lib/chartDefaults";

export const EVENT_COLORS: Record<string, string> = {
  SC: "#ffd12e",
  VSC: "#ff9d2e",
  RED: "#e10600",
};

export interface Band {
  from: number;
  to: number;
  type: string;
}

export interface LineStyle {
  stroke: string;
  strokeWidth: number;
  strokeOpacity: number;
  strokeDasharray?: string;
}

interface Props {
  data: Record<string, number>[];
  drivers: string[];
  styleOf: (driver: string) => LineStyle;
  colorOf: (driver: string) => string;
  /** Pilotos destacados (o vacío): sus etiquetas y paradas se resaltan. */
  emphasized: Set<string>;
  bands: Band[];
  pitWindow: { from: number; to: number } | null;
  pits: { driver: string; lap: number }[];
  onToggle: (driver: string) => void;
  onHover: (driver: string | null) => void;
  height: number;
}

/**
 * Gráfica de posiciones por vuelta ("bump chart"): curvas suaves, etiqueta con
 * el código de cada piloto al final de su línea (clicable para destacarlo),
 * paradas marcadas sobre la línea y bandas de SC/VSC/bandera roja rotuladas.
 */
export const PositionsChart = memo(function PositionsChart({
  data,
  drivers,
  styleOf,
  colorOf,
  emphasized,
  bands,
  pitWindow,
  pits,
  onToggle,
  onHover,
  height,
}: Props) {
  // Último punto con dato de cada piloto (los retirados terminan antes)
  const lastIndex = useMemo(() => {
    const m: Record<string, number> = {};
    data.forEach((row, i) => {
      for (const d of drivers) if (row[d] != null) m[d] = i;
    });
    return m;
  }, [data, drivers]);

  const posAt = useMemo(() => {
    const byLap = new Map(data.map((r) => [r.lap, r]));
    return (driver: string, lap: number) => byLap.get(lap)?.[driver];
  }, [data]);

  const n = drivers.length;
  const lastLap = data[data.length - 1]?.lap ?? 0;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 18, right: 46, bottom: 0, left: -22 }}>
        <CartesianGrid {...GRID} />
        <XAxis
          dataKey="lap"
          {...AXIS}
          type="number"
          domain={[1, lastLap]}
          tickCount={Math.min(12, lastLap)}
          allowDecimals={false}
        />
        <YAxis
          {...AXIS}
          reversed
          domain={[1, n]}
          ticks={Array.from({ length: n }, (_, i) => i + 1)}
          interval={0}
          allowDecimals={false}
          fontSize={10}
        />
        <Tooltip
          content={<PositionsTooltip colorOf={colorOf} emphasized={emphasized} />}
          cursor={{ stroke: "rgb(255 255 255 / 0.25)" }}
          isAnimationActive={false}
          wrapperStyle={{ zIndex: 50 }}
        />

        {pitWindow && (
          <ReferenceArea x1={pitWindow.from} x2={pitWindow.to} fill="#a1a1aa" fillOpacity={0.05} />
        )}
        {bands.map((b, i) => (
          <ReferenceArea
            key={i}
            x1={b.from}
            x2={Math.max(b.to, b.from + 0.6)}
            fill={EVENT_COLORS[b.type]}
            fillOpacity={0.1}
            label={{
              value: b.type === "RED" ? "ROJA" : b.type,
              position: "insideTop",
              fill: EVENT_COLORS[b.type],
              fontSize: 9,
              fontWeight: 700,
              dy: -14,
            }}
          />
        ))}

        {drivers.map((d) => {
          const st = styleOf(d);
          return (
            <Line
              key={d}
              type="monotone"
              dataKey={d}
              {...st}
              dot={false}
              activeDot={
                emphasized.size === 0 || emphasized.has(d)
                  ? { r: 3.5, strokeWidth: 0, fill: st.stroke }
                  : false
              }
              isAnimationActive={false}
              connectNulls
              label={(props: { x?: number | string; y?: number | string; index?: number }) => {
                if (props.index !== lastIndex[d] || props.x == null || props.y == null)
                  return <g key={`${d}-l-${props.index}`} />;
                const strong = emphasized.size === 0 || emphasized.has(d);
                return (
                  <g
                    key={`${d}-label`}
                    transform={`translate(${Number(props.x) + 6} ${Number(props.y)})`}
                    style={{ cursor: "pointer" }}
                    onClick={() => onToggle(d)}
                    onMouseEnter={() => onHover(d)}
                    onMouseLeave={() => onHover(null)}
                  >
                    <rect
                      x={-2}
                      y={-7}
                      width={34}
                      height={14}
                      rx={7}
                      fill={strong ? `${st.stroke}26` : "transparent"}
                    />
                    <text
                      x={15}
                      y={3.5}
                      textAnchor="middle"
                      fontSize={9.5}
                      fontWeight={800}
                      fill={st.stroke}
                      fillOpacity={strong ? 1 : 0.4}
                    >
                      {d}
                    </text>
                  </g>
                );
              }}
            />
          );
        })}

        {/* Paradas de los pilotos destacados, sobre su propia línea */}
        {pits.map((p, i) => {
          const y = posAt(p.driver, p.lap);
          if (y == null) return null;
          return (
            <ReferenceDot
              key={`pit-${i}`}
              x={p.lap}
              y={y}
              r={4}
              fill="#0a0a0f"
              stroke={colorOf(p.driver)}
              strokeWidth={2}
            />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
});

interface TooltipProps {
  active?: boolean;
  label?: number | string;
  payload?: { dataKey?: string | number; value?: number; payload?: Record<string, number> }[];
  colorOf: (d: string) => string;
  emphasized: Set<string>;
}

/** Tooltip compacto: clasificación de la vuelta en dos columnas, con ▲▼ respecto a la vuelta anterior. */
function PositionsTooltip({ active, label, payload, colorOf, emphasized }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const rows = payload
    .filter((p) => typeof p.value === "number")
    .map((p) => ({ driver: String(p.dataKey), pos: p.value as number }))
    .sort((a, b) => a.pos - b.pos);
  const prev = (payload[0]?.payload as Record<string, number> & { __prev?: Record<string, number> })
    ?.__prev;
  const half = Math.ceil(rows.length / 2);
  const cols = [rows.slice(0, half), rows.slice(half)];
  return (
    <div className="menu-surface rounded-[16px] px-3 py-2.5 text-[11px]">
      <p className="mb-1.5 font-bold text-ink-2">Vuelta {label}</p>
      <div className="grid grid-cols-2 gap-x-4">
        {cols.map((col, c) => (
          <div key={c} className="space-y-0.5">
            {col.map((r) => {
              const before = prev?.[r.driver];
              const diff = before != null ? before - r.pos : 0;
              const strong = emphasized.size === 0 || emphasized.has(r.driver);
              return (
                <div
                  key={r.driver}
                  className={`flex items-center gap-1.5 ${strong ? "" : "opacity-40"}`}
                >
                  <span className="w-4 text-right font-mono tabular-nums text-ink-3">{r.pos}</span>
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: colorOf(r.driver) }}
                  />
                  <span
                    className={`w-8 font-bold ${emphasized.has(r.driver) ? "text-white" : "text-ink"}`}
                  >
                    {r.driver}
                  </span>
                  <span
                    className={`w-5 font-mono text-[10px] ${diff > 0 ? "text-emerald-400" : diff < 0 ? "text-red-400" : "text-transparent"}`}
                  >
                    {diff > 0 ? `▲${diff}` : diff < 0 ? `▼${-diff}` : "·"}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
