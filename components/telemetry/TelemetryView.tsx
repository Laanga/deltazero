"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { memo, useEffect, useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useShallow } from "zustand/react/shallow";

import { ChartPanel, ChartSkeleton, EmptyState } from "@/components/ChartPanel";
import { DriverAvatar } from "@/components/DriverAvatar";
import { LapPicker } from "@/components/telemetry/LapPicker";
import { TrackMap, type DriverMeta } from "@/components/telemetry/TrackMap";
import { useMergedTelemetry } from "@/components/telemetry/useMergedTelemetry";
import { seekRequest, usePlayback } from "@/components/telemetry/usePlayback";
import { Badge } from "@/components/ui/Chip";
import { IconButton } from "@/components/ui/Button";
import { useCircuit, useDrivers, useTelemetry } from "@/hooks/useF1Data";
import { DRIVER_PHOTOS } from "@/lib/champAssets";
import { AXIS, GRID, TOOLTIP } from "@/lib/chartDefaults";
import { lowerBound } from "@/lib/f1math";
import type { TelemetryData } from "@/lib/types";
import { formatDelta, formatLapTime, lineDashFor } from "@/lib/utils";
import { useCursorStore } from "@/store/cursorStore";
import { useSessionStore } from "@/store/sessionStore";

// Geometría del área de trazado de las gráficas (debe cuadrar con margin + YAxis width)
const CHART_MARGIN = { top: 6, right: 10, bottom: 0, left: -14 };
const Y_AXIS_W = 46;
const X_AXIS_H = 30;
const PLOT_LEFT = CHART_MARGIN.left + Y_AXIS_W;

interface ChartOpts {
  domain?: [number, number];
  format?: (v: number) => string;
  deltaMode?: boolean;
  sectorLines?: boolean;
}

type Merged = Record<string, number | null>[];

export function TelemetryView() {
  const selectedDrivers = useSessionStore((s) => s.selectedDrivers);
  const { data: drivers } = useDrivers();
  const { data: telemetry, isLoading, isError, error, failed } = useTelemetry();
  const { data: circuit } = useCircuit();

  const ref = telemetry[0];
  const timeChannel = ref?.channels.time;
  usePlayback(timeChannel);

  // Nueva vuelta o nuevos pilotos: suelta el cursor (los índices ya no valen)
  useEffect(() => {
    useCursorStore.getState().reset();
  }, [telemetry]);
  useEffect(() => () => useCursorStore.getState().reset(), []);

  const driverMeta = useMemo(
    () =>
      telemetry.map((t) => {
        const info = drivers?.find((d) => d.abbreviation === t.driver);
        return {
          abbr: t.driver,
          team_color: info?.team_color ?? "#888",
          headshot_url: DRIVER_PHOTOS[t.driver] ?? info?.headshot_url ?? null,
          full_name: info?.full_name ?? t.driver,
        };
      }),
    [telemetry, drivers],
  );

  const merged = useMergedTelemetry(telemetry);
  const maxDist = ref ? ref.channels.distance[ref.channels.distance.length - 1] : 0;

  // Distancias donde termina S1 y S2, según los tiempos de sector del piloto de referencia
  const sectorSplits = useMemo(() => {
    if (!ref?.sectors || ref.sectors.s1 == null || ref.sectors.s2 == null) return null;
    const { time, distance } = ref.channels;
    const distAt = (t: number) => distance[Math.min(distance.length - 1, lowerBound(time, t))];
    return { d1: distAt(ref.sectors.s1), d2: distAt(ref.sectors.s1 + ref.sectors.s2) };
  }, [ref]);

  // Distancia de cada curva oficial sobre la vuelta de referencia (para "Curva N")
  const cornerMarks = useMemo(() => {
    if (!ref?.track || !circuit?.corners.length) return [];
    const { x, y } = ref.track;
    return circuit.corners.map((c) => {
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < x.length; i++) {
        const d = (x[i] - c.x) ** 2 + (y[i] - c.y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return { label: `${c.number}${c.letter}`, distance: ref.channels.distance[best] };
    });
  }, [ref, circuit]);

  if (selectedDrivers.length === 0) {
    return (
      <EmptyState
        message="Selecciona al menos un piloto para ver su telemetría"
        hint="Puedes comparar hasta cinco pilotos. El primero que elijas es la referencia del delta y del mapa."
      />
    );
  }
  if (isError) {
    return (
      <EmptyState
        tone="error"
        message="No se pudo cargar la telemetría"
        hint={`Puede ser un límite temporal de la API o que esta sesión aún no tenga datos publicados (~15 min tras la sesión). Detalle: ${error?.message ?? "desconocido"}`}
      />
    );
  }
  if (isLoading || !ref) {
    return (
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="order-2 space-y-5 xl:order-1 xl:col-span-2">
          <ChartSkeleton height={340} />
          <ChartSkeleton height={220} />
        </div>
        <ChartSkeleton height={560} className="order-1 xl:order-2" />
      </div>
    );
  }

  const channelCsv = (channel: string) => (): (string | number | null)[][] => {
    const header = ["distancia_m", ...telemetry.map((t) => `${channel}_${t.driver}`)];
    const rows = merged.map((r) => [
      r.distance,
      ...telemetry.map((t) => r[`${channel}_${t.driver}`] ?? ""),
    ]);
    return [header, ...rows];
  };

  const chart = (channel: string, height: number, opts: ChartOpts = {}) => (
    <TelemetryChart
      data={merged}
      channel={channel}
      height={height}
      meta={driverMeta}
      maxDist={maxDist}
      sectorSplits={opts.sectorLines ? sectorSplits : null}
      opts={opts}
    />
  );

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      {/* Columna izquierda: gráficas (debajo del mapa en móvil) */}
      <div className="order-2 min-w-0 space-y-5 xl:order-1 xl:col-span-2">
        <div className="flex flex-wrap items-center gap-2">
          <LapPicker />
          <div className="flex flex-wrap gap-1.5 md:ml-auto">
            {telemetry.map((t, i) => (
              <div
                key={t.driver}
                className="fill-control flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm"
              >
                <DriverAvatar
                  url={driverMeta[i].headshot_url}
                  color={driverMeta[i].team_color}
                  size={26}
                  alt={t.driver}
                />
                <span className="font-bold">{t.driver}</span>
                <span className="font-mono text-xs tabular-nums text-ink-2">
                  {formatLapTime(t.lap_time)}
                </span>
                <span className="text-[10px] text-ink-3">V{t.lap_number}</span>
              </div>
            ))}
          </div>
        </div>
        {failed.length > 0 && (
          <p className="rounded-full bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
            Sin telemetría para {failed.join(", ")} en esta vuelta: se muestran el resto de pilotos.
          </p>
        )}

        <ChartPanel
          title="Velocidad"
          subtitle={sectorSplits ? "km/h · líneas = límites de sector" : "km/h"}
          exportName="velocidad"
          csvRows={channelCsv("speed")}
        >
          {chart("speed", 300, { sectorLines: true })}
        </ChartPanel>

        <ChartPanel
          title="Revoluciones"
          subtitle="rpm"
          exportName="rpm"
          csvRows={channelCsv("rpm")}
        >
          {chart("rpm", 170, { format: (v) => `${Math.round(v / 1000)}k` })}
        </ChartPanel>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <ChartPanel title="Acelerador" subtitle="%">
            {chart("throttle", 170, { domain: [0, 100] })}
          </ChartPanel>
          <ChartPanel title="Marcha">{chart("gear", 170)}</ChartPanel>
          <ChartPanel title="Freno" subtitle="on / off">
            {chart("brake", 170, { domain: [0, 100] })}
          </ChartPanel>
          {telemetry.length > 1 ? (
            <ChartPanel title={`Delta vs ${ref.driver}`} subtitle="positivo = pierde tiempo">
              {chart("delta", 170, {
                format: (v) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}`,
                deltaMode: true,
              })}
            </ChartPanel>
          ) : (
            <ChartPanel title="Delta" subtitle="necesita un segundo piloto">
              <div className="flex h-[170px] items-center justify-center text-sm text-ink-3">
                Añade otro piloto para ver el delta
              </div>
            </ChartPanel>
          )}
        </div>
      </div>

      {/* Columna derecha: mapa fijo durante el scroll (arriba en móvil) */}
      <div className="order-1 min-w-0 xl:order-2">
        <div className="space-y-5 xl:sticky xl:top-24">
          <ChartPanel
            title="Circuito"
            subtitle={ref.track ? "arrastra sobre el trazado · doble clic suelta" : undefined}
          >
            {ref.track ? (
              <TrackMap
                telemetry={telemetry}
                meta={driverMeta}
                circuit={circuit}
                sectorSplits={sectorSplits}
              />
            ) : (
              <div className="flex h-40 items-center justify-center rounded-[22px] bg-black/30 px-6 text-center text-xs text-ink-3">
                Mapa no disponible: esta sesión aún no tiene datos de posición. El reproductor y las
                gráficas funcionan igualmente.
              </div>
            )}
            <Player timeChannel={ref.channels.time} />
            <Readout telemetry={telemetry} meta={driverMeta} cornerMarks={cornerMarks} />
          </ChartPanel>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Gráfica de un canal: memoizada, NO se suscribe al cursor             */
/* ------------------------------------------------------------------ */

const onChartHover = (state: unknown) => {
  const raw = (state as { activeTooltipIndex?: number | string })?.activeTooltipIndex;
  const idx = raw != null ? Number(raw) : NaN;
  if (Number.isFinite(idx)) useCursorStore.getState().scrub(idx);
};

const TelemetryChart = memo(function TelemetryChart({
  data,
  channel,
  height,
  meta,
  maxDist,
  sectorSplits,
  opts,
}: {
  data: Merged;
  channel: string;
  height: number;
  meta: DriverMeta[];
  maxDist: number;
  sectorSplits: { d1: number; d2: number } | null;
  opts: ChartOpts;
}) {
  const series = opts.deltaMode ? meta.slice(1) : meta;
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} syncId="telemetry" margin={CHART_MARGIN} onMouseMove={onChartHover}>
          <CartesianGrid {...GRID} />
          <XAxis
            dataKey="distance"
            type="number"
            domain={[0, Math.ceil(maxDist)]}
            {...AXIS}
            height={X_AXIS_H}
            tickFormatter={(v) => `${v}m`}
            minTickGap={60}
          />
          <YAxis
            {...AXIS}
            domain={opts.domain ?? ["auto", "auto"]}
            width={Y_AXIS_W}
            tickFormatter={opts.format}
          />
          <Tooltip
            {...TOOLTIP}
            cursor={false}
            labelFormatter={(v) => `${v} m`}
            isAnimationActive={false}
          />
          {sectorSplits && (
            <>
              <ReferenceLine
                x={Math.round(sectorSplits.d1)}
                stroke="#71717a"
                strokeDasharray="2 4"
                label={{ value: "S2", position: "insideTopLeft", fill: "#a1a1aa", fontSize: 10 }}
              />
              <ReferenceLine
                x={Math.round(sectorSplits.d2)}
                stroke="#71717a"
                strokeDasharray="2 4"
                label={{ value: "S3", position: "insideTopLeft", fill: "#a1a1aa", fontSize: 10 }}
              />
            </>
          )}
          {series.map((d, i) => (
            <Line
              key={d.abbr}
              type="monotone"
              dataKey={`${channel}_${d.abbr}`}
              name={opts.deltaMode ? `Δ ${d.abbr}` : d.abbr}
              stroke={d.team_color}
              strokeWidth={channel === "speed" ? 2.2 : 1.8}
              strokeDasharray={lineDashFor(opts.deltaMode ? i + 1 : i, meta)}
              dot={false}
              activeDot={{ r: 3.5, strokeWidth: 0 }}
              animationDuration={700}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <ChartCursor data={data} maxDist={maxDist} />
    </div>
  );
});

/** Línea del cursor sobre la gráfica: lo único que se re-renderiza al mover el punto. */
function ChartCursor({ data, maxDist }: { data: Merged; maxDist: number }) {
  const idx = useCursorStore((s) => s.idx);
  if (idx == null || !maxDist) return null;
  const dist = data[Math.min(idx, data.length - 1)]?.distance;
  if (dist == null) return null;
  const frac = Math.max(0, Math.min(1, dist / Math.ceil(maxDist)));
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute w-px bg-white/70"
      style={{
        top: CHART_MARGIN.top,
        bottom: X_AXIS_H,
        left: `calc(${PLOT_LEFT}px + (100% - ${PLOT_LEFT + CHART_MARGIN.right}px) * ${frac})`,
        boxShadow: "0 0 8px rgb(255 255 255 / 0.5)",
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Reproductor                                                         */
/* ------------------------------------------------------------------ */

function Player({ timeChannel }: { timeChannel: number[] }) {
  const { idx, playing, speed, setIdx, setPlaying, setSpeed } = useCursorStore(
    useShallow((s) => ({
      idx: s.idx,
      playing: s.playing,
      speed: s.speed,
      setIdx: s.setIdx,
      setPlaying: s.setPlaying,
      setSpeed: s.setSpeed,
    })),
  );
  const lapEnd = timeChannel[timeChannel.length - 1] ?? 0;
  const t = idx != null ? timeChannel[Math.min(idx, timeChannel.length - 1)] : 0;
  const frac = lapEnd ? t / lapEnd : 0;

  const seekTo = (target: number) => {
    if (playing) seekRequest.t = target;
    else setIdx(lowerBound(timeChannel, target));
  };

  return (
    <div className="mt-4 flex items-center gap-2.5">
      <IconButton
        aria-label={playing ? "Pausar" : "Reproducir vuelta"}
        variant="primary"
        size="lg"
        onClick={() => setPlaying((p) => !p)}
      >
        {playing ? (
          <Pause size={18} fill="currentColor" />
        ) : (
          <Play size={18} fill="currentColor" className="ml-0.5" />
        )}
      </IconButton>
      <IconButton aria-label="Reiniciar" variant="ghost" size="sm" onClick={() => seekTo(0)}>
        <RotateCcw size={14} />
      </IconButton>

      {/* Barra de progreso estilo iOS: crece al pasar o tocar */}
      <div
        role="slider"
        tabIndex={0}
        aria-label="Posición en la vuelta"
        aria-valuemin={0}
        aria-valuemax={Math.round(lapEnd * 10) / 10}
        aria-valuenow={Math.round(t * 10) / 10}
        aria-valuetext={`${t.toFixed(1)} segundos`}
        className="group relative flex h-8 flex-1 cursor-pointer items-center"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          const r = e.currentTarget.getBoundingClientRect();
          seekTo(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * lapEnd);
        }}
        onPointerMove={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
          const r = e.currentTarget.getBoundingClientRect();
          seekTo(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * lapEnd);
        }}
        onKeyDown={(e) => {
          const stepS = e.shiftKey ? 5 : 1;
          if (e.key === "ArrowRight") seekTo(Math.min(lapEnd, t + stepS));
          else if (e.key === "ArrowLeft") seekTo(Math.max(0, t - stepS));
          else if (e.key === " ") setPlaying((p) => !p);
          else return;
          e.preventDefault();
        }}
      >
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/[0.1] transition-[height] duration-200 group-hover:h-2.5 group-active:h-2.5">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-white"
            style={{ width: `${frac * 100}%` }}
          />
        </div>
      </div>

      <span className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums text-ink-2">
        {t.toFixed(1)}s
      </span>

      <div
        className="fill-control flex shrink-0 rounded-full p-0.5"
        role="group"
        aria-label="Velocidad de reproducción"
      >
        {[1, 2, 4].map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={speed === s}
            onClick={() => setSpeed(s)}
            className={`pressable h-7 rounded-full px-2 text-[10px] font-bold tabular-nums ${speed === s ? "bg-white/[0.16] text-white" : "text-ink-3 hover:text-ink"}`}
          >
            ×{s}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lecturas del punto seleccionado                                     */
/* ------------------------------------------------------------------ */

function sectorOf(t: TelemetryData, i: number): 1 | 2 | 3 | null {
  if (!t.sectors || t.sectors.s1 == null || t.sectors.s2 == null) return null;
  const tc = t.channels.time[i];
  if (tc == null) return null;
  if (tc < t.sectors.s1) return 1;
  if (tc < t.sectors.s1 + t.sectors.s2) return 2;
  return 3;
}

function Readout({
  telemetry,
  meta,
  cornerMarks,
}: {
  telemetry: TelemetryData[];
  meta: (DriverMeta & { headshot_url: string | null })[];
  cornerMarks: { label: string; distance: number }[];
}) {
  const idx = useCursorStore((s) => s.idx);
  const scrub = useCursorStore((s) => s.scrub);
  const ref = telemetry[0];

  if (idx == null) {
    return (
      <p className="mt-4 rounded-[18px] bg-white/[0.04] px-4 py-3 text-xs leading-relaxed text-ink-3">
        Pulsa ▶ para reproducir la vuelta, arrastra sobre el trazado o pasa el ratón por las
        gráficas para inspeccionar un punto exacto. Los marcadores del mapa muestran dónde estaba
        cada piloto en el mismo instante de su vuelta.
      </p>
    );
  }

  const ri = Math.min(idx, ref.channels.distance.length - 1);
  const dist = ref.channels.distance[ri];
  let corner: string | null = null;
  let bestDelta = 120;
  for (const c of cornerMarks) {
    const d = Math.abs(c.distance - dist);
    if (d < bestDelta) {
      bestDelta = d;
      corner = c.label;
    }
  }
  const sector = sectorOf(ref, ri);

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-ink">
          {corner ? `Curva ${corner}` : "Recta"}
        </span>
        <span className="font-mono text-[11px] text-ink-3">{Math.round(dist)} m</span>
        {sector && <Badge>S{sector}</Badge>}
        <button
          type="button"
          onClick={() => scrub(null)}
          className="pressable ml-auto rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-3 hover:bg-white/[0.07] hover:text-ink"
        >
          Soltar
        </button>
      </div>

      {/* Grupo inset estilo iOS: filas redondeadas con separadores finos */}
      <div className="overflow-hidden rounded-[18px] bg-white/[0.04]">
        {telemetry.map((t, k) => {
          const i = Math.min(idx, t.channels.speed.length - 1);
          const cur = sectorOf(t, i);
          const delta =
            k > 0
              ? t.channels.time[i] - ref.channels.time[Math.min(idx, ref.channels.time.length - 1)]
              : null;
          return (
            <div key={t.driver} className="border-b border-white/[0.06] px-3 py-2.5 last:border-0">
              <div className="flex items-center gap-2.5 text-sm">
                <DriverAvatar
                  url={meta[k]?.headshot_url}
                  color={meta[k]?.team_color ?? "#888"}
                  size={26}
                  alt={t.driver}
                />
                <span className="w-9 font-bold">{t.driver}</span>
                <span className="font-mono tabular-nums">
                  <span className="font-bold">{Math.round(t.channels.speed[i])}</span>
                  <span className="ml-0.5 text-[10px] text-ink-3">km/h</span>
                </span>
                <span className="font-mono text-xs text-ink-2">M{t.channels.gear[i]}</span>
                <span className="font-mono text-xs tabular-nums text-ink-2">
                  {Math.round(t.channels.throttle[i])}%
                </span>
                <span className="ml-auto flex items-center gap-1.5">
                  {delta != null && (
                    <span
                      className={`font-mono text-[11px] tabular-nums ${delta > 0 ? "text-red-300" : "text-emerald-300"}`}
                    >
                      {formatDelta(delta)}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-1.5 py-px text-[9px] font-bold ${t.channels.brake[i] ? "bg-red-500/25 text-red-300" : "text-ink-3/50"}`}
                  >
                    FRENO
                  </span>
                  <span
                    className={`rounded-full px-1.5 py-px text-[9px] font-bold ${t.channels.drs[i] ? "bg-green-500/25 text-green-300" : "text-ink-3/50"}`}
                  >
                    DRS
                  </span>
                </span>
              </div>
              {t.sectors && (
                <div className="mt-2 flex gap-1">
                  {(
                    [
                      ["S1", t.sectors.s1],
                      ["S2", t.sectors.s2],
                      ["S3", t.sectors.s3],
                    ] as const
                  ).map(([label, val], si) => (
                    <span
                      key={label}
                      className={`flex-1 rounded-full py-0.5 text-center font-mono text-[10px] tabular-nums transition-colors
                        ${cur === si + 1 ? "bg-f1red/25 text-white" : "bg-white/[0.04] text-ink-3"}`}
                    >
                      <span className="text-ink-3">{label}</span>{" "}
                      {val != null ? val.toFixed(3) : "—"}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
