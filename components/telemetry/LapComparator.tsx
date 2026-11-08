"use client";

import { ArrowLeftRight, Map as MapIcon } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ChartPanel } from "@/components/ChartPanel";
import { DriverAvatar } from "@/components/DriverAvatar";
import type { DuelData } from "@/components/telemetry/TrackMap";
import { Button, IconButton } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import {
  alignedIndex,
  alignedValue,
  gapMetersAtTime,
  lapLength,
  lapStats,
  sectorDeltas,
  zoneGains,
  type Zone,
} from "@/lib/duel";
import { lowerBound, valueAtDistance } from "@/lib/f1math";
import type { TelemetryData } from "@/lib/types";
import { formatLapTime } from "@/lib/utils";
import { useCursorStore } from "@/store/cursorStore";
import { useMapStore } from "@/store/mapStore";

const fmt = (s: number, digits = 3) => `${Math.abs(s).toFixed(digits)} s`;

interface Props {
  /** Todos los pilotos cargados (el primero es la base del cursor y del mapa). */
  telemetry: TelemetryData[];
  duel: DuelData;
  headshots: Record<string, string | null>;
  /** Curvas oficiales con su distancia sobre la vuelta de telemetry[0]. */
  cornerMarks: { label: string; distance: number }[];
}

/**
 * Comparador de vuelta: delta en vivo, separación en pista, dónde se gana y
 * se pierde (por curva y por sector) y estadísticas de la vuelta. Todo se
 * compara por fracción de vuelta (ver lib/duel.ts) y el reloj está anclado a
 * los tiempos oficiales, así que el delta final coincide con la diferencia
 * oficial de tiempos de vuelta.
 */
export function LapComparator({ telemetry, duel, headshots, cornerMarks }: Props) {
  const { ref, rival, refColor, rivalColor, delta } = duel;
  const setDuel = useMapStore((s) => s.setDuel);
  const setMode = useMapStore((s) => s.setMode);
  const base = telemetry[0];

  // Curvas sobre la rejilla de la referencia del duelo (pueden venir de otro piloto base)
  const zones = useMemo(() => {
    const scale = lapLength(ref) / lapLength(base);
    const corners = cornerMarks.map((c) => ({
      label: `Curva ${c.label}`,
      distance: c.distance * scale,
    }));
    if (corners.length) return zoneGains(ref, delta, corners);
    // Sin curvas oficiales: diez tramos iguales de la vuelta
    const L = lapLength(ref);
    const equal = Array.from({ length: 10 }, (_, k) => ({
      label: `Tramo ${k + 1}`,
      distance: ((k + 0.5) / 10) * L,
    }));
    return zoneGains(ref, delta, equal);
  }, [cornerMarks, ref, base, delta]);

  const topRef = useMemo(
    () =>
      [...zones]
        .filter((z) => z.refGain > 0.0005)
        .sort((a, b) => b.refGain - a.refGain)
        .slice(0, 3),
    [zones],
  );
  const topRival = useMemo(
    () =>
      [...zones]
        .filter((z) => z.refGain < -0.0005)
        .sort((a, b) => a.refGain - b.refGain)
        .slice(0, 3),
    [zones],
  );
  const sectors = useMemo(() => sectorDeltas(ref, rival), [ref, rival]);
  const stats = useMemo(() => ({ ref: lapStats(ref), rival: lapStats(rival) }), [ref, rival]);
  const finalDelta = delta[delta.length - 1] ?? 0;

  const options = telemetry.map((t) => t.driver);
  const choose = (side: "ref" | "rival", driver: string) => {
    const other = side === "ref" ? rival.driver : ref.driver;
    // Elegir el mismo piloto en ambos lados = intercambiar
    if (driver === other) setDuel({ ref: rival.driver, rival: ref.driver });
    else
      setDuel(
        side === "ref" ? { ref: driver, rival: rival.driver } : { ref: ref.driver, rival: driver },
      );
  };

  return (
    <ChartPanel
      title="Comparador de vuelta"
      subtitle="delta, separación en pista y dónde se gana o se pierde"
      actions={
        <Button size="sm" variant="secondary" onClick={() => setMode("duel")} className="h-8">
          <MapIcon size={13} /> Ver en el mapa
        </Button>
      }
    >
      {/* Duelo: referencia vs rival */}
      <div className="flex flex-wrap items-center gap-2">
        <DriverPick
          label="Referencia"
          t={ref}
          color={refColor}
          headshot={headshots[ref.driver]}
          options={options}
          onChoose={(d) => choose("ref", d)}
        />
        <IconButton
          aria-label="Intercambiar referencia y rival"
          size="sm"
          onClick={() => setDuel({ ref: rival.driver, rival: ref.driver })}
        >
          <ArrowLeftRight size={14} />
        </IconButton>
        <DriverPick
          label="Rival"
          t={rival}
          color={rivalColor}
          headshot={headshots[rival.driver]}
          options={options}
          onChoose={(d) => choose("rival", d)}
        />
        <p className="ml-auto text-right text-xs text-ink-3 max-sm:w-full max-sm:text-left">
          Vuelta completa:{" "}
          {Math.abs(finalDelta) < 0.0005 ? (
            <span className="font-bold text-ink">empate</span>
          ) : (
            <>
              <span className="font-bold" style={{ color: finalDelta > 0 ? refColor : rivalColor }}>
                {finalDelta > 0 ? ref.driver : rival.driver}
              </span>{" "}
              más rápido por{" "}
              <span className="font-mono font-bold text-ink tabular-nums">{fmt(finalDelta)}</span>
            </>
          )}
        </p>
      </div>

      {ref.lap_time != null &&
        rival.lap_time != null &&
        Math.abs(rival.lap_time - ref.lap_time) / Math.min(ref.lap_time, rival.lap_time) > 0.03 && (
          <p className="mt-3 rounded-[16px] bg-amber-500/10 px-4 py-2.5 text-xs leading-relaxed text-amber-200">
            Las dos vueltas difieren más de un 3 % ({formatLapTime(ref.lap_time)} frente a{" "}
            {formatLapTime(rival.lap_time)}): probablemente una es de salida, entrada o
            enfriamiento. Para comparar pilotado, elige la vuelta más rápida o una vuelta lanzada de
            ambos.
          </p>
        )}

      <LiveReadout base={base} duel={duel} cornerMarks={cornerMarks} />

      <DeltaStrip base={base} duel={duel} cornerMarks={cornerMarks} />

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Sectores oficiales */}
        <div className="rounded-[20px] bg-white/[0.035] p-4">
          <p className="eyebrow mb-3">Sectores</p>
          <div className="space-y-2.5">
            {sectors.map((s) => (
              <div key={s.sector} className="flex items-center gap-3 text-sm">
                <span className="w-6 font-bold text-ink-3">S{s.sector}</span>
                {s.diff == null ? (
                  <span className="text-xs text-ink-3">sin tiempo oficial</span>
                ) : (
                  <>
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: s.diff >= 0 ? refColor : rivalColor }}
                    />
                    <span className="font-bold">
                      {Math.abs(s.diff) < 0.0005 ? "=" : s.diff > 0 ? ref.driver : rival.driver}
                    </span>
                    <span className="ml-auto font-mono text-xs tabular-nums text-ink-2">
                      {fmt(s.diff)}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Dónde se marca la diferencia */}
        <div className="rounded-[20px] bg-white/[0.035] p-4 lg:col-span-1">
          <p className="eyebrow mb-3">Dónde se marca la diferencia</p>
          <div className="grid grid-cols-2 gap-3">
            <ZoneList driver={ref.driver} color={refColor} zones={topRef} sign={1} />
            <ZoneList driver={rival.driver} color={rivalColor} zones={topRival} sign={-1} />
          </div>
        </div>

        {/* Estadísticas */}
        <div className="rounded-[20px] bg-white/[0.035] p-4">
          <div className="mb-3 flex items-center">
            <p className="eyebrow flex-1">Vuelta</p>
            <span
              className="w-[4.6rem] text-right text-[11px] font-bold"
              style={{ color: refColor }}
            >
              {ref.driver}
            </span>
            <span
              className="w-[4.6rem] text-right text-[11px] font-bold"
              style={{ color: rivalColor }}
            >
              {rival.driver}
            </span>
          </div>
          <StatRow
            label="Tiempo"
            a={formatLapTime(ref.lap_time)}
            b={formatLapTime(rival.lap_time)}
            better={cmp(ref.lap_time, rival.lap_time, "low")}
          />
          <StatRow
            label="Vel. punta"
            a={`${Math.round(stats.ref.topSpeed)}`}
            b={`${Math.round(stats.rival.topSpeed)}`}
            unit="km/h"
            better={cmp(stats.ref.topSpeed, stats.rival.topSpeed, "high")}
          />
          <StatRow
            label="Vel. mínima"
            a={`${Math.round(stats.ref.minSpeed)}`}
            b={`${Math.round(stats.rival.minSpeed)}`}
            unit="km/h"
            better={cmp(stats.ref.minSpeed, stats.rival.minSpeed, "high")}
          />
          <StatRow
            label="Gas a fondo"
            a={`${stats.ref.fullThrottle.toFixed(0)}%`}
            b={`${stats.rival.fullThrottle.toFixed(0)}%`}
            better={cmp(stats.ref.fullThrottle, stats.rival.fullThrottle, "high")}
          />
          <StatRow
            label="Frenando"
            a={`${stats.ref.braking.toFixed(0)}%`}
            b={`${stats.rival.braking.toFixed(0)}%`}
          />
        </div>
      </div>
    </ChartPanel>
  );
}

function cmp(a: number | null, b: number | null, prefer: "low" | "high"): "a" | "b" | null {
  if (a == null || b == null || Math.abs(a - b) < 1e-6) return null;
  return (prefer === "low" ? a < b : a > b) ? "a" : "b";
}

function StatRow({
  label,
  a,
  b,
  unit,
  better,
}: {
  label: string;
  a: string;
  b: string;
  unit?: string;
  better?: "a" | "b" | null;
}) {
  return (
    <div className="flex items-center border-t border-white/[0.05] py-1.5 text-xs first-of-type:border-0">
      <span className="flex-1 text-ink-3">
        {label}
        {unit && <span className="text-ink-3/60"> · {unit}</span>}
      </span>
      <span
        className={`w-[4.6rem] text-right font-mono tabular-nums ${better === "a" ? "font-bold text-white" : "text-ink-2"}`}
      >
        {a}
      </span>
      <span
        className={`w-[4.6rem] text-right font-mono tabular-nums ${better === "b" ? "font-bold text-white" : "text-ink-2"}`}
      >
        {b}
      </span>
    </div>
  );
}

function ZoneList({
  driver,
  color,
  zones,
  sign,
}: {
  driver: string;
  color: string;
  zones: Zone[];
  sign: 1 | -1;
}) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        Gana {driver}
      </p>
      {zones.length === 0 ? (
        <p className="text-xs text-ink-3">—</p>
      ) : (
        <ul className="space-y-1">
          {zones.map((z) => (
            <li key={z.label} className="flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate text-ink-2">{z.label}</span>
              <span className="font-mono tabular-nums text-ink">
                {(sign * z.refGain).toFixed(3)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DriverPick({
  label,
  t,
  color,
  headshot,
  options,
  onChoose,
}: {
  label: string;
  t: TelemetryData;
  color: string;
  headshot: string | null | undefined;
  options: string[];
  onChoose: (driver: string) => void;
}) {
  const content = (
    <span className="flex items-center gap-2">
      <DriverAvatar url={headshot} color={color} size={26} alt={t.driver} />
      <span className="font-bold" style={{ color }}>
        {t.driver}
      </span>
      <span className="font-mono text-xs tabular-nums text-ink-2">{formatLapTime(t.lap_time)}</span>
    </span>
  );
  return (
    <div className="flex items-center gap-2">
      <span className="eyebrow max-sm:hidden">{label}</span>
      {options.length > 2 ? (
        <Dropdown
          compact
          label=""
          value={t.driver}
          selectedKey={t.driver}
          options={options}
          display={(d) => ({ key: d, text: d })}
          onSelect={onChoose}
          className="[&>p]:hidden"
        />
      ) : (
        <span className="fill-control rounded-full py-1 pl-1 pr-3">{content}</span>
      )}
      {options.length > 2 && <span className="max-sm:hidden">{content}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lectura en vivo en el punto del cursor                               */
/* ------------------------------------------------------------------ */

function LiveReadout({
  base,
  duel,
  cornerMarks,
}: {
  base: TelemetryData;
  duel: DuelData;
  cornerMarks: { label: string; distance: number }[];
}) {
  const idx = useCursorStore((s) => s.idx);
  const { ref, rival, refColor, rivalColor } = duel;

  if (idx == null) {
    return (
      <p className="mt-4 rounded-[18px] bg-white/[0.035] px-4 py-3 text-xs leading-relaxed text-ink-3">
        Reproduce la vuelta o pasa por la gráfica para ver el delta en cada punto. Arriba de la
        línea gana <b style={{ color: refColor }}>{ref.driver}</b>; abajo,{" "}
        <b style={{ color: rivalColor }}>{rival.driver}</b>.
      </p>
    );
  }

  // El cursor vive en la rejilla del piloto base; se traslada a la referencia del duelo
  const bi = Math.min(idx, base.channels.distance.length - 1);
  const ri = alignedIndex(base, ref, bi);
  const d = duel.delta[Math.min(ri, duel.delta.length - 1)];
  const time = ref.channels.time[ri];
  const gap = gapMetersAtTime(ref, rival, time);
  const vRef = ref.channels.speed[ri];
  const vRival = alignedValue(ref, rival, "speed", ri);

  const dist = base.channels.distance[bi];
  let corner: string | null = null;
  let best = 120;
  for (const c of cornerMarks) {
    const dd = Math.abs(c.distance - dist);
    if (dd < best) {
      best = dd;
      corner = c.label;
    }
  }

  const leader = Math.abs(d) < 0.0005 ? null : d > 0 ? ref : rival;
  return (
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Metric
        label={corner ? `Curva ${corner}` : "Recta"}
        value={`${Math.round(ref.channels.distance[ri])} m`}
        sub="punto de la vuelta"
      />
      <Metric
        label="Delta"
        value={leader ? `${leader.driver} · ${fmt(d)}` : "empate"}
        color={leader ? (leader === ref ? refColor : rivalColor) : undefined}
        sub="ventaja acumulada"
      />
      <Metric
        label="En pista"
        value={Math.abs(gap) < 0.5 ? "a la par" : `${Math.abs(gap).toFixed(0)} m`}
        color={Math.abs(gap) < 0.5 ? undefined : gap > 0 ? rivalColor : refColor}
        sub={
          Math.abs(gap) < 0.5
            ? "mismo instante"
            : `${gap > 0 ? rival.driver : ref.driver} por delante`
        }
      />
      <Metric
        label="Velocidad"
        value={`${Math.round(vRef)} · ${Math.round(vRival)}`}
        sub={`km/h · ${ref.driver} / ${rival.driver}`}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color?: string;
}) {
  return (
    <div className="rounded-[18px] bg-white/[0.035] px-3.5 py-2.5">
      <p className="eyebrow truncate">{label}</p>
      <p
        className="mt-1 truncate font-mono text-sm font-bold tabular-nums"
        style={color ? { color } : undefined}
      >
        {value}
      </p>
      <p className="truncate text-[10px] text-ink-3">{sub}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tira de delta a lo largo de la vuelta                               */
/* ------------------------------------------------------------------ */

const STRIP_H = 132;
const PAD_X = 8;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;

function useWidth() {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, w] as const;
}

function DeltaStrip({
  base,
  duel,
  cornerMarks,
}: {
  base: TelemetryData;
  duel: DuelData;
  cornerMarks: { label: string; distance: number }[];
}) {
  const [setEl, width] = useWidth();
  const scrub = useCursorStore((s) => s.scrub);
  const cursorIdx = useCursorStore((s) => s.idx);
  const draggingRef = useRef(false);
  const { ref } = duel;
  const L = lapLength(ref);
  const scaleBase = lapLength(ref) / lapLength(base);

  const geom = useMemo(() => {
    const maxAbs = Math.max(0.05, ...duel.delta.map(Math.abs)) * 1.12;
    const plotW = Math.max(1, width - PAD_X * 2);
    const plotH = STRIP_H - PAD_TOP - PAD_BOTTOM;
    const zeroY = PAD_TOP + plotH / 2;
    const x = (d: number) => PAD_X + (d / L) * plotW;
    const y = (v: number) => zeroY - (v / maxAbs) * (plotH / 2);
    return { maxAbs, plotW, plotH, zeroY, x, y };
  }, [duel.delta, width, L]);

  const toBaseIdx = useCallback(
    (clientX: number, rect: DOMRect) => {
      const frac = Math.min(
        1,
        Math.max(0, (clientX - rect.left - PAD_X) / Math.max(1, rect.width - PAD_X * 2)),
      );
      const dBase = frac * lapLength(base);
      return Math.min(base.channels.distance.length - 1, lowerBound(base.channels.distance, dBase));
    },
    [base],
  );

  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold text-ink-3">
        <span>
          ▲ gana <b style={{ color: duel.refColor }}>{duel.ref.driver}</b> · ▼ gana{" "}
          <b style={{ color: duel.rivalColor }}>{duel.rival.driver}</b>
        </span>
        <span className="font-mono tabular-nums">±{geom.maxAbs.toFixed(2)} s</span>
      </div>
      <div
        ref={setEl}
        className="relative cursor-crosshair touch-none select-none rounded-[18px] bg-black/25 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.05)]"
        style={{ height: STRIP_H }}
        role="slider"
        tabIndex={0}
        aria-label="Delta a lo largo de la vuelta"
        aria-valuemin={0}
        aria-valuemax={Math.round(L)}
        aria-valuenow={
          cursorIdx == null
            ? 0
            : Math.round(
                (base.channels.distance[Math.min(cursorIdx, base.channels.distance.length - 1)] /
                  lapLength(base)) *
                  L,
              )
        }
        aria-valuetext={cursorIdx == null ? "sin punto seleccionado" : undefined}
        onPointerDown={(e) => {
          draggingRef.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          scrub(toBaseIdx(e.clientX, e.currentTarget.getBoundingClientRect()));
        }}
        onPointerMove={(e) => {
          if (draggingRef.current)
            scrub(toBaseIdx(e.clientX, e.currentTarget.getBoundingClientRect()));
        }}
        onPointerUp={() => {
          draggingRef.current = false;
        }}
        onPointerCancel={() => {
          draggingRef.current = false;
        }}
        onKeyDown={(e) => {
          const { idx } = useCursorStore.getState();
          const n = base.channels.distance.length;
          const step = e.shiftKey ? 40 : 8;
          if (e.key === "ArrowRight") scrub(Math.min(n - 1, (idx ?? 0) + step));
          else if (e.key === "ArrowLeft") scrub(Math.max(0, (idx ?? 0) - step));
          else if (e.key === "Escape") scrub(null);
          else return;
          e.preventDefault();
        }}
      >
        {width > 0 && (
          <svg width={width} height={STRIP_H} className="absolute inset-0 block">
            <StripStatic duel={duel} geom={geom} cornerMarks={cornerMarks} scaleBase={scaleBase} />
            <StripCursor base={base} duel={duel} geom={geom} />
          </svg>
        )}
      </div>
    </div>
  );
}

type StripGeom = {
  maxAbs: number;
  plotW: number;
  plotH: number;
  zeroY: number;
  x: (d: number) => number;
  y: (v: number) => number;
};

const StripStatic = memo(function StripStatic({
  duel,
  geom,
  cornerMarks,
  scaleBase,
}: {
  duel: DuelData;
  geom: StripGeom;
  cornerMarks: { label: string; distance: number }[];
  scaleBase: number;
}) {
  const { ref, delta, refColor, rivalColor } = duel;
  const { x, y, zeroY, plotH } = geom;
  const dist = ref.channels.distance;

  // Reducimos a ~1 punto por píxel para que el path sea ligero
  const step = Math.max(1, Math.floor(dist.length / Math.max(1, geom.plotW)));
  let line = "";
  for (let i = 0; i < dist.length; i += step)
    line += `${i === 0 ? "M" : "L"}${x(dist[i]).toFixed(1)},${y(delta[i]).toFixed(1)}`;
  const lastI = dist.length - 1;
  line += `L${x(dist[lastI]).toFixed(1)},${y(delta[lastI]).toFixed(1)}`;
  const area = `${line}L${x(dist[lastI]).toFixed(1)},${zeroY}L${x(0).toFixed(1)},${zeroY}Z`;
  const uid = `${ref.driver}-${duel.rival.driver}`;
  const cornerTicks = [...cornerMarks]
    .sort((a, b) => a.distance - b.distance)
    .reduce<{ label: string; x: number; showLabel: boolean; lastX: number }[]>((acc, c) => {
      const cx = x(c.distance * scaleBase);
      const lastX = acc.length ? acc[acc.length - 1].lastX : -Infinity;
      const showLabel = cx - lastX >= 16;
      acc.push({ label: c.label, x: cx, showLabel, lastX: showLabel ? cx : lastX });
      return acc;
    }, []);

  return (
    <g>
      <defs>
        <clipPath id={`above-${uid}`}>
          <rect x={0} y={0} width="100%" height={zeroY} />
        </clipPath>
        <clipPath id={`below-${uid}`}>
          <rect x={0} y={zeroY} width="100%" height={STRIP_H} />
        </clipPath>
      </defs>

      {/* Curvas oficiales: la línea siempre, la etiqueta solo si no pisa a la anterior */}
      {cornerTicks.map((c) => (
        <g key={c.label}>
          <line
            x1={c.x}
            x2={c.x}
            y1={PAD_TOP}
            y2={PAD_TOP + plotH}
            stroke="rgb(255 255 255 / 0.05)"
          />
          {c.showLabel && (
            <text
              x={c.x}
              y={STRIP_H - 7}
              textAnchor="middle"
              fontSize={8.5}
              fill="#71717a"
              fontWeight={600}
            >
              {c.label}
            </text>
          )}
        </g>
      ))}

      <path d={area} fill={refColor} fillOpacity={0.28} clipPath={`url(#above-${uid})`} />
      <path d={area} fill={rivalColor} fillOpacity={0.28} clipPath={`url(#below-${uid})`} />
      <line
        x1={x(0)}
        x2={x(dist[lastI])}
        y1={zeroY}
        y2={zeroY}
        stroke="rgb(255 255 255 / 0.25)"
        strokeDasharray="2 3"
      />
      <path
        d={line}
        fill="none"
        stroke={refColor}
        strokeWidth={1.8}
        clipPath={`url(#above-${uid})`}
      />
      <path
        d={line}
        fill="none"
        stroke={rivalColor}
        strokeWidth={1.8}
        clipPath={`url(#below-${uid})`}
      />
    </g>
  );
});

function StripCursor({
  base,
  duel,
  geom,
}: {
  base: TelemetryData;
  duel: DuelData;
  geom: StripGeom;
}) {
  const idx = useCursorStore((s) => s.idx);
  if (idx == null) return null;
  const bi = Math.min(idx, base.channels.distance.length - 1);
  const dRef = (base.channels.distance[bi] / lapLength(base)) * lapLength(duel.ref);
  const v = valueAtDistance(duel.ref.channels.distance, duel.delta, dRef);
  const cx = geom.x(dRef);
  const cy = geom.y(v);
  const color = v >= 0 ? duel.refColor : duel.rivalColor;
  return (
    <g className="pointer-events-none">
      <line
        x1={cx}
        x2={cx}
        y1={PAD_TOP - 4}
        y2={PAD_TOP + geom.plotH + 2}
        stroke="rgb(255 255 255 / 0.7)"
      />
      <circle cx={cx} cy={cy} r={4.5} fill={color} stroke="#fff" strokeWidth={2} />
    </g>
  );
}
