"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
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

import { ChartPanel, ChartSkeleton, EmptyState } from "@/components/ChartPanel";
import { DriverAvatar } from "@/components/DriverAvatar";
import { LapPicker } from "@/components/telemetry/LapPicker";
import { TrackMap } from "@/components/telemetry/TrackMap";
import { useMergedTelemetry } from "@/components/telemetry/useMergedTelemetry";
import { usePlayback } from "@/components/telemetry/usePlayback";
import { useCircuit, useDrivers, useTelemetry } from "@/hooks/useF1Data";
import { AXIS, GRID, TOOLTIP } from "@/lib/chartDefaults";
import type { TelemetryData } from "@/lib/types";
import { formatDelta, formatLapTime, lineDashFor } from "@/lib/utils";
import { useSessionStore } from "@/store/sessionStore";

export function TelemetryView() {
  const { selectedDrivers } = useSessionStore();
  const { data: drivers } = useDrivers();
  const { data: telemetry, isLoading, isError, error } = useTelemetry();
  const { data: circuit } = useCircuit();
  // Índice de distancia seleccionado: sincroniza charts ↔ mapa en ambos sentidos
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const timeChannel = telemetry?.[0]?.channels.time;
  const lapEnd = timeChannel?.[timeChannel.length - 1] ?? 0;
  const { playing, setPlaying, playSpeed, setPlaySpeed, seekRef } = usePlayback({
    timeChannel,
    lapEnd,
    hoverIdx,
    setHoverIdx,
  });

  // Interacción manual (arrastrar mapa / hover en charts) pausa la reproducción
  const manualHover = (idx: number | null) => {
    setPlaying(false);
    setHoverIdx(idx);
  };

  const driverMeta = useMemo(
    () =>
      selectedDrivers.map((abbr) => {
        const info = drivers?.find((d) => d.abbreviation === abbr);
        return {
          abbr,
          team_color: info?.team_color ?? "#888",
          headshot_url: info?.headshot_url ?? null,
        };
      }),
    [selectedDrivers, drivers],
  );
  const metaOf = (abbr: string) => driverMeta.find((d) => d.abbr === abbr);
  const colorOf = (abbr: string) => metaOf(abbr)?.team_color ?? "#888";

  // Mezcla los canales de todos los pilotos por índice de distancia
  const merged = useMergedTelemetry(telemetry);

  // Curva más cercana al punto seleccionado (por distancia en el trazado)
  const nearestCorner = useMemo(() => {
    if (hoverIdx == null || !telemetry?.length || !circuit?.corners?.length) return null;
    const dist = telemetry[0].channels.distance[hoverIdx];
    let best = null;
    let bestDelta = Infinity;
    for (const c of circuit.corners) {
      if (c.distance == null) continue;
      const delta = Math.abs(c.distance - dist);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = c;
      }
    }
    return best && bestDelta < 250 ? best : null;
  }, [hoverIdx, circuit, telemetry]);

  // Distancias donde termina S1 y S2, según los tiempos de sector del piloto de referencia
  const sectorSplits = useMemo(() => {
    const ref = telemetry?.[0];
    if (!ref?.sectors || ref.sectors.s1 == null || ref.sectors.s2 == null) return null;
    const { time, distance } = ref.channels;
    const distAt = (tSplit: number) => {
      let lo = 0, hi = time.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (time[mid] < tSplit) lo = mid + 1;
        else hi = mid;
      }
      return distance[lo];
    };
    return { d1: distAt(ref.sectors.s1), d2: distAt(ref.sectors.s1 + ref.sectors.s2) };
  }, [telemetry]);

  // Sector (1/2/3) en el que está un piloto en el índice dado, según sus tiempos de sector
  const sectorOf = (t: TelemetryData, i: number): 1 | 2 | 3 | null => {
    if (!t.sectors || t.sectors.s1 == null || t.sectors.s2 == null) return null;
    const tc = t.channels.time[i];
    if (tc == null) return null;
    if (tc < t.sectors.s1) return 1;
    if (tc < t.sectors.s1 + t.sectors.s2) return 2;
    return 3;
  };

  if (selectedDrivers.length === 0) {
    return <EmptyState message="Selecciona al menos un piloto para ver su telemetría" />;
  }
  if (isError) {
    return (
      <EmptyState
        tone="error"
        message="No se pudo cargar la telemetría"
        hint={`Puede ser un límite temporal de la API o que esta sesión aún no tenga datos publicados (~15 min tras la sesión). Detalle: ${(error as Error).message}`}
      />
    );
  }
  if (isLoading || !telemetry?.length) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          <ChartSkeleton height={420} />
          <div className="lg:col-span-3 space-y-4">
            <ChartSkeleton height={200} />
            <ChartSkeleton height={200} />
          </div>
        </div>
        <ChartSkeleton height={300} />
      </div>
    );
  }

  const onChartHover = (state: unknown) => {
    const raw = (state as { activeTooltipIndex?: number | string })?.activeTooltipIndex;
    const idx = raw != null ? Number(raw) : NaN;
    if (Number.isFinite(idx)) manualHover(idx);
  };

  // CSV de un canal: distancia + valor por piloto
  const channelCsv = (channel: string) => (): (string | number | null)[][] => {
    const header = ["distancia_m", ...telemetry.map((t) => `${channel}_${t.driver}`)];
    const rows = merged.map((r) => [r.distance, ...telemetry.map((t) => r[`${channel}_${t.driver}`] ?? "")]);
    return [header, ...rows];
  };

  const renderChart = (
    key: string,
    height: number,
    opts: { domain?: [number, number]; format?: (v: number) => string; deltaMode?: boolean; sectorLines?: boolean } = {},
  ) => (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={merged}
        syncId="telemetry"
        margin={{ top: 4, right: 8, bottom: 0, left: -16 }}
        onMouseMove={onChartHover}
      >
        <CartesianGrid {...GRID} />
        <XAxis dataKey="distance" {...AXIS} tickFormatter={(v) => `${v}m`} minTickGap={60} />
        <YAxis
          {...AXIS}
          domain={opts.domain ?? ["auto", "auto"]}
          width={48}
          tickFormatter={opts.format}
        />
        <Tooltip {...TOOLTIP} labelFormatter={(v) => `${v} m`} />
        {opts.sectorLines && sectorSplits && (
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
        {hoverIdx != null && merged[hoverIdx] && (
          <ReferenceLine
            x={merged[hoverIdx].distance ?? undefined}
            stroke="#e8e8ec"
            strokeDasharray="4 3"
            strokeOpacity={0.7}
          />
        )}
        {(opts.deltaMode ? driverMeta.slice(1) : driverMeta).map((d, i) => (
          <Line
            key={d.abbr}
            type="monotone"
            dataKey={`${key}_${d.abbr}`}
            name={opts.deltaMode ? `Δ ${d.abbr}` : d.abbr}
            stroke={d.team_color}
            strokeWidth={key === "speed" ? 2.2 : 1.8}
            strokeDasharray={lineDashFor(opts.deltaMode ? i + 1 : i, driverMeta)}
            dot={false}
            animationDuration={900}
            animationEasing="ease-out"
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      {/* Columna izquierda: gráficas (debajo del mapa en móvil) */}
      <div className="order-2 space-y-5 xl:order-1 xl:col-span-2">
        <div className="flex items-center justify-between">
          <LapPicker />
          <div className="flex gap-4">
            {telemetry.map((t) => (
              <div key={t.driver} className="flex items-center gap-2 text-sm">
                <DriverAvatar url={metaOf(t.driver)?.headshot_url} color={colorOf(t.driver)} size={28} alt={t.driver} />
                <span className="font-bold">{t.driver}</span>
                <span className="font-mono text-zinc-400">{formatLapTime(t.lap_time)}</span>
                <span className="text-xs text-zinc-600">V{t.lap_number}</span>
              </div>
            ))}
          </div>
        </div>

        <ChartPanel
          title="Velocidad"
          subtitle={sectorSplits ? "km/h · líneas grises = límites de sector" : "km/h"}
          exportName="velocidad"
          csvRows={channelCsv("speed")}
        >
          {renderChart("speed", 300, { sectorLines: true })}
        </ChartPanel>

        <ChartPanel title="Revoluciones" subtitle="rpm" exportName="rpm" csvRows={channelCsv("rpm")}>
          {renderChart("rpm", 180, { format: (v) => `${Math.round(v / 1000)}k` })}
        </ChartPanel>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <ChartPanel title="Acelerador" subtitle="%">
            {renderChart("throttle", 180, { domain: [0, 100] })}
          </ChartPanel>
          <ChartPanel title="Marcha" subtitle="">
            {renderChart("gear", 180)}
          </ChartPanel>
          <ChartPanel title="Freno" subtitle="%">
            {renderChart("brake", 180, { domain: [0, 100] })}
          </ChartPanel>
          {telemetry.length > 1 ? (
            <ChartPanel
              title={`Delta vs ${telemetry[0].driver}`}
              subtitle="positivo = pierde tiempo"
            >
              {renderChart("delta", 180, { format: (v) => formatDelta(v), deltaMode: true })}
            </ChartPanel>
          ) : (
            <ChartPanel title="Delta" subtitle="selecciona un segundo piloto para comparar">
              <div className="flex h-[180px] items-center justify-center text-sm text-zinc-600">
                Añade otro piloto para ver el delta
              </div>
            </ChartPanel>
          )}
        </div>
      </div>

      {/* Columna derecha: mapa fijo durante el scroll + punto seleccionado (arriba en móvil) */}
      <div className="order-1 xl:order-2">
        <div className="sticky top-4 space-y-5">
          <ChartPanel
            title="Circuito"
            subtitle={telemetry[0].track ? "arrastra la bolita · doble clic para soltar" : undefined}
          >
            {telemetry[0].track ? (
              <TrackMap
                reference={telemetry[0]}
                corners={circuit?.corners ?? []}
                hoverIdx={hoverIdx}
                onHover={manualHover}
              />
            ) : (
              <div className="flex h-40 items-center justify-center px-6 text-center text-xs text-zinc-600">
                Mapa no disponible: esta sesión aún no tiene datos de posición.
                El reproductor y las gráficas funcionan igualmente.
              </div>
            )}

            {/* Reproductor de vuelta */}
            <div className="mt-3 flex items-center gap-3 border-t border-edge pt-3">
              <button
                onClick={() => setPlaying((p) => !p)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-f1red text-white shadow-lg shadow-f1red/30 transition-transform hover:scale-110 active:scale-95"
                title={playing ? "Pausar" : "Reproducir vuelta"}
              >
                {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
              </button>
              <button
                onClick={() => {
                  seekRef.current = 0;
                  setHoverIdx(0);
                }}
                className="shrink-0 text-zinc-500 transition-colors hover:text-zinc-200"
                title="Reiniciar"
              >
                <RotateCcw size={14} />
              </button>

              <div
                className="group relative h-2 flex-1 cursor-pointer rounded-full bg-panel-light"
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
                  const t = frac * lapEnd;
                  if (playing) {
                    seekRef.current = t;
                  } else if (timeChannel) {
                    let lo = 0, hi = timeChannel.length - 1;
                    while (lo < hi) {
                      const mid = (lo + hi) >> 1;
                      if (timeChannel[mid] < t) lo = mid + 1;
                      else hi = mid;
                    }
                    setHoverIdx(lo);
                  }
                }}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-f1red transition-[width] duration-75"
                  style={{
                    width: `${hoverIdx != null && timeChannel ? (timeChannel[Math.min(hoverIdx, timeChannel.length - 1)] / lapEnd) * 100 : 0}%`,
                  }}
                />
              </div>

              <span className="shrink-0 font-mono text-[11px] tabular-nums text-zinc-400">
                {hoverIdx != null && timeChannel
                  ? timeChannel[Math.min(hoverIdx, timeChannel.length - 1)].toFixed(1)
                  : "0.0"}
                s
              </span>

              <div className="flex shrink-0 gap-1">
                {[1, 2, 3, 4].map((s) => (
                  <button
                    key={s}
                    onClick={() => setPlaySpeed(s)}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition-colors
                      ${playSpeed === s ? "bg-f1red text-white" : "bg-panel-light text-zinc-500 hover:text-zinc-200"}`}
                  >
                    ×{s}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 border-t border-edge pt-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  {hoverIdx != null
                    ? nearestCorner
                      ? `Curva ${nearestCorner.number}${nearestCorner.letter}`
                      : "Recta"
                    : "Sin punto seleccionado"}
                  {hoverIdx != null && (
                    <span className="ml-2 font-mono font-normal text-zinc-600">
                      {Math.round(telemetry[0].channels.distance[hoverIdx])} m
                    </span>
                  )}
                  {hoverIdx != null &&
                    (() => {
                      const s = sectorOf(telemetry[0], Math.min(hoverIdx, telemetry[0].channels.time.length - 1));
                      return s ? (
                        <span className="ml-2 rounded-sm border border-edge bg-white/5 px-1 font-mono text-[10px] text-zinc-400">
                          S{s}
                        </span>
                      ) : null;
                    })()}
                </span>
                {hoverIdx != null && (
                  <button
                    className="rounded border border-edge px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-500 transition-colors hover:border-f1red/50 hover:text-zinc-300"
                    onClick={() => setHoverIdx(null)}
                  >
                    soltar
                  </button>
                )}
              </div>

              {hoverIdx != null ? (
                <div className="space-y-1.5">
                  {telemetry.map((t) => {
                    const i = Math.min(hoverIdx, t.channels.speed.length - 1);
                    const curSector = sectorOf(t, i);
                    return (
                      <div
                        key={t.driver}
                        className="rounded border border-edge bg-panel px-3 py-2 text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <DriverAvatar url={metaOf(t.driver)?.headshot_url} color={colorOf(t.driver)} size={24} alt={t.driver} />
                          <span className="w-10 font-bold">{t.driver}</span>
                          <span className="font-mono text-zinc-100">
                            <span className="font-bold">{Math.round(t.channels.speed[i])}</span>
                            <span className="ml-1 text-[10px] text-zinc-500">km/h</span>
                          </span>
                          <span className="font-mono text-xs text-zinc-400">M{t.channels.gear[i]}</span>
                          <span className="font-mono text-xs text-zinc-400">{Math.round(t.channels.throttle[i])}%</span>
                          <span className={`ml-auto text-[10px] font-bold ${t.channels.brake[i] ? "text-red-400" : "text-zinc-700"}`}>
                            FRENO
                          </span>
                          <span className={`text-[10px] font-bold ${t.channels.drs[i] ? "text-green-400" : "text-zinc-700"}`}>
                            DRS
                          </span>
                        </div>
                        {t.sectors && (
                          <div className="mt-1.5 flex gap-1.5 border-t border-edge/50 pt-1.5">
                            {([["S1", t.sectors.s1], ["S2", t.sectors.s2], ["S3", t.sectors.s3]] as const).map(
                              ([label, val], si) => (
                                <span
                                  key={label}
                                  className={`flex-1 rounded px-1.5 py-0.5 text-center font-mono text-[10px] transition-colors
                                    ${curSector === si + 1 ? "bg-f1red/20 text-white" : "text-zinc-500"}`}
                                >
                                  <span className="text-zinc-600">{label}</span> {val != null ? val.toFixed(3) : "—"}
                                </span>
                              ),
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-zinc-600">
                  Arrastra la bolita por el trazado o pasa el ratón por las gráficas para
                  inspeccionar un punto exacto de la vuelta.
                </p>
              )}
            </div>
          </ChartPanel>
        </div>
      </div>
    </div>
  );
}
