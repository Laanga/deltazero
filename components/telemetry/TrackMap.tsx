"use client";

import { Focus, Maximize2 } from "lucide-react";
import { memo, useEffect, useMemo, useRef } from "react";
import { useShallow } from "zustand/react/shallow";

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { gainSegments, gapMetersAtTime, lapLength } from "@/lib/duel";
import {
  decimate,
  dominance,
  indexAtTime,
  makeFrame,
  nearestIndex,
  smoothPath,
  speedColor,
  type Pt,
  type TrackFrame,
} from "@/lib/trackGeometry";
import type { CircuitInfo, TelemetryData } from "@/lib/types";
import { useCursorStore } from "@/store/cursorStore";
import { useMapStore, type MapMode } from "@/store/mapStore";

const W = 520;
const H_RANGE: [number, number] = [300, 480];
const PAD = 38;
const FOLLOW_ZOOM = 2.6;
const SECTOR_COLORS = ["#ff4d6d", "#38bdf8", "#facc15"] as const;

export interface DriverMeta {
  abbr: string;
  team_color: string;
}

/** Duelo resuelto (pilotos cargados + delta precalculado) que llega desde TelemetryView. */
export interface DuelData {
  ref: TelemetryData;
  rival: TelemetryData;
  refColor: string;
  rivalColor: string;
  /** Delta sobre la rejilla de `ref` (rival − ref, s). */
  delta: number[];
}

interface TrackMapProps {
  telemetry: TelemetryData[];
  meta: DriverMeta[];
  circuit: CircuitInfo | undefined;
  /** Distancias (m) donde acaban S1 y S2 en la vuelta de referencia. */
  sectorSplits: { d1: number; d2: number } | null;
  duel: DuelData | null;
}

/** Curvas oficiales proyectadas, con la etiqueta desplazada hacia fuera según su ángulo. */
function projectCorners(circuit: CircuitInfo | undefined, frame: TrackFrame) {
  return (circuit?.corners ?? []).map((c) => {
    const p = frame.project(c.x, c.y);
    const a = (c.angle * Math.PI) / 180;
    const q = frame.project(c.x + Math.cos(a) * 400, c.y + Math.sin(a) * 400);
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    return {
      key: `${c.number}${c.letter}`,
      label: `${c.number}${c.letter}`,
      x: p.x + (dx / len) * 19,
      y: p.y + (dy / len) * 19,
      ax: p.x,
      ay: p.y,
    };
  });
}

/** Línea de meta perpendicular al trazado en el primer punto + ángulo del sentido de la marcha. */
function finishLine(pts: Pt[]) {
  const p0 = pts[0];
  const p1 = pts[Math.min(4, pts.length - 1)];
  const len = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1;
  const nx = -(p1.y - p0.y) / len;
  const ny = (p1.x - p0.x) / len;
  return {
    p0,
    finish: { x1: p0.x - nx * 10, y1: p0.y - ny * 10, x2: p0.x + nx * 10, y2: p0.y + ny * 10 },
    dirAngle: (Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180) / Math.PI,
  };
}

/**
 * Mapa del circuito con todos los pilotos en pista al mismo instante de
 * vuelta. Rotación oficial y curvas numeradas (MultiViewer), capas de color
 * (sectores / velocidad / dominio / duelo) y cámara que sigue al piloto.
 *
 * Rendimiento: marcadores, etiqueta de distancia y cámara se actualizan
 * escribiendo en el DOM desde un único bucle rAF; React solo re-renderiza al
 * cambiar de capa o de datos, nunca por el cursor.
 */
export function TrackMap({ telemetry, meta, circuit, sectorSplits, duel }: TrackMapProps) {
  const ref = telemetry[0];
  const {
    mode: storedMode,
    setMode,
    follow,
    setFollow,
  } = useMapStore(
    useShallow((s) => ({
      mode: s.mode,
      setMode: s.setMode,
      follow: s.follow,
      setFollow: s.setFollow,
    })),
  );
  const multi = telemetry.length > 1;
  // Capas que necesitan dos pilotos caen a "sectores" si solo hay uno
  const mode: MapMode =
    !multi && (storedMode === "dominance" || storedMode === "duel") ? "sectors" : storedMode;
  const duelOn = mode === "duel" && !!duel;
  // El seguimiento solo vale para pilotos cargados
  const followed = follow && telemetry.some((t) => t.driver === follow) ? follow : null;

  const svgRef = useRef<SVGSVGElement>(null);
  const cameraRef = useRef<SVGGElement>(null);
  const markerRefs = useRef(new Map<string, SVGGElement>());
  const gapTextRef = useRef<SVGTextElement>(null);
  const gapBgRef = useRef<SVGRectElement>(null);
  const draggingRef = useRef(false);

  const colorOf = useMemo(() => {
    const m = new Map(meta.map((d) => [d.abbr, d.team_color]));
    return (abbr: string) => {
      if (duelOn && duel && abbr === duel.rival.driver) return duel.rivalColor;
      return m.get(abbr) ?? "#888";
    };
  }, [meta, duelOn, duel]);

  /* ---------- Geometría (solo cambia con los datos) ---------- */
  const geo = useMemo(() => {
    // El asfalto se dibuja con la traza real de la vuelta de referencia: así la
    // capa de color y los coches van exactamente sobre él (la silueta de
    // MultiViewer es otra vuelta y, con zoom, se notaría el desfase).
    const frame = makeFrame([ref.track!], circuit?.rotation ?? 0, W, H_RANGE, PAD);
    const refPts = ref.track!.x.map((x, i) => frame.project(x, ref.track!.y[i]));
    const tracks = new Map<string, Pt[]>();
    for (const t of telemetry) {
      if (t.track)
        tracks.set(
          t.driver,
          t.track.x.map((x, i) => frame.project(x, t.track!.y[i])),
        );
    }
    return {
      frame,
      refPts,
      basePath: smoothPath(decimate(refPts, 1.2), true),
      tracks,
      corners: projectCorners(circuit, frame),
      ...finishLine(refPts),
    };
  }, [ref, telemetry, circuit]);

  /* ---------- Capas de color ---------- */
  const overlay = useMemo((): Overlay => {
    const pts = geo.refPts;
    const n = pts.length;
    // Tramo por fracción de vuelta → puntos del trazado de referencia del mapa
    const sliceFrac = (f0: number, f1: number) =>
      smoothPath(
        pts.slice(Math.max(0, Math.floor(f0 * (n - 1))), Math.min(n, Math.ceil(f1 * (n - 1)) + 1)),
        false,
      );

    if (mode === "speed") {
      const sp = ref.channels.speed;
      let min = Infinity;
      let max = -Infinity;
      for (const v of sp) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
      const segs: Seg[] = [];
      const STEP = 4;
      for (let i = 0; i < n - 1; i += STEP) {
        const j = Math.min(n - 1, i + STEP);
        segs.push({
          d:
            `M${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)}` +
            pts
              .slice(i + 1, j + 1)
              .map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`)
              .join(""),
          color: speedColor((sp[i] + sp[j]) / 2, min, max),
        });
      }
      return { segs, legend: { kind: "speed", min: Math.round(min), max: Math.round(max) } };
    }

    if (mode === "duel" && duel) {
      const segs = gainSegments(duel.delta, 64);
      const maxAbs = Math.max(1e-6, ...segs.map((s) => Math.abs(s.refGain)));
      return {
        segs: segs.map((s) => ({
          d: sliceFrac(s.from, s.to),
          color: s.refGain >= 0 ? duel.refColor : duel.rivalColor,
          // Intensidad proporcional a cuánto se gana en el tramo (mínimo visible)
          opacity: 0.3 + 0.7 * Math.min(1, Math.abs(s.refGain) / maxAbs),
        })),
        legend: {
          kind: "duel",
          ref: duel.ref.driver,
          rival: duel.rival.driver,
          refColor: duel.refColor,
          rivalColor: duel.rivalColor,
        },
      };
    }

    if (mode === "dominance" && multi) {
      const dom = dominance(telemetry, 25);
      const counts = new Map<string, number>();
      for (const s of dom) counts.set(s.driver, (counts.get(s.driver) ?? 0) + 1);
      return {
        segs: dom.map((s) => ({ d: sliceFrac(s.from, s.to), color: colorOf(s.driver) })),
        legend: {
          kind: "dominance",
          shares: telemetry.map((t) => ({
            driver: t.driver,
            pct: Math.round(((counts.get(t.driver) ?? 0) / dom.length) * 100),
          })),
        },
      };
    }

    // Sectores (y zonas de DRS si las hay)
    const L = lapLength(ref);
    const f1 = sectorSplits ? sectorSplits.d1 / L : 1 / 3;
    const f2 = sectorSplits ? sectorSplits.d2 / L : 2 / 3;
    const drs: string[] = [];
    const ch = ref.channels.drs;
    for (let i = 0; i < n; i++) {
      if (!ch[i]) continue;
      let j = i;
      while (j + 1 < n && ch[j + 1]) j++;
      if (j - i > 6) drs.push(smoothPath(pts.slice(i, j + 1), false));
      i = j;
    }
    return {
      segs: [
        { d: sliceFrac(0, f1), color: SECTOR_COLORS[0] },
        { d: sliceFrac(f1, f2), color: SECTOR_COLORS[1] },
        { d: sliceFrac(f2, 1), color: SECTOR_COLORS[2] },
      ],
      drs,
      legend: { kind: "sectors", exact: !!sectorSplits },
    };
  }, [mode, geo, ref, telemetry, multi, colorOf, sectorSplits, duel]);

  /* ---------- Bucle de animación: marcadores, distancia del duelo y cámara ---------- */
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let idleT = 0;
    let visible = true;
    const lapEnd = ref.channels.time[ref.channels.time.length - 1] || 90;
    const H = geo.frame.height;
    const cam = { x: W / 2, y: H / 2, s: 1 };
    const n = geo.refPts.length;

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    if (svgRef.current) io.observe(svgRef.current);

    const positionAt = (t: TelemetryData, time: number): Pt => {
      const i = indexAtTime(t, time);
      const own = geo.tracks.get(t.driver);
      if (own) return own[Math.min(i, own.length - 1)];
      // Sin posición propia: misma fracción de vuelta sobre el trazado de referencia
      const frac = t.channels.distance[i] / lapLength(t);
      return geo.refPts[Math.min(n - 1, Math.round(frac * (n - 1)))];
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!visible) return;

      const { idx } = useCursorStore.getState();
      let time: number;
      if (idx == null) {
        // Sin punto seleccionado: vuelta fantasma en bucle a ×4
        idleT = (idleT + dt * 4) % lapEnd;
        time = idleT;
      } else {
        time = ref.channels.time[Math.min(idx, ref.channels.time.length - 1)];
        idleT = time;
      }

      let focus: Pt | null = null;
      for (const t of telemetry) {
        const g = markerRefs.current.get(t.driver);
        if (!g) continue;
        const p = positionAt(t, time);
        g.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
        if (t.driver === followed) focus = p;
      }

      // Distancia entre los dos pilotos del duelo, en la etiqueta del fantasma
      if (duelOn && duel && gapTextRef.current) {
        const m = gapMetersAtTime(duel.ref, duel.rival, time);
        const txt = Math.abs(m) < 0.5 ? "= 0 m" : `${m > 0 ? "+" : "−"}${Math.abs(m).toFixed(0)} m`;
        if (gapTextRef.current.textContent !== txt) {
          gapTextRef.current.textContent = txt;
          gapBgRef.current?.setAttribute("width", String(10 + txt.length * 5.6));
        }
      }

      // Cámara: interpolación suave hacia el piloto seguido (o vista completa)
      const target = focus
        ? { x: focus.x, y: focus.y, s: FOLLOW_ZOOM }
        : { x: W / 2, y: H / 2, s: 1 };
      const k = 1 - Math.pow(0.0015, dt);
      cam.x += (target.x - cam.x) * k;
      cam.y += (target.y - cam.y) * k;
      cam.s += (target.s - cam.s) * k;
      cameraRef.current?.setAttribute(
        "transform",
        `translate(${(W / 2 - cam.x * cam.s).toFixed(2)} ${(H / 2 - cam.y * cam.s).toFixed(2)}) scale(${cam.s.toFixed(4)})`,
      );
      // Etiquetas y marcadores mantienen su tamaño en pantalla con el zoom
      svgRef.current?.style.setProperty("--inv", String(1 / cam.s));
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [geo, ref, telemetry, followed, duelOn, duel]);

  /* ---------- Interacción: arrastrar por el trazado ---------- */
  const scrub = useCursorStore((s) => s.scrub);
  const indexFromPointer = (clientX: number, clientY: number) => {
    const ctm = cameraRef.current?.getScreenCTM();
    if (!ctm) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return nearestIndex(geo.refPts, p.x, p.y);
  };

  const modes = [
    { id: "sectors" as const, label: "Sectores" },
    { id: "speed" as const, label: "Velocidad" },
    ...(multi
      ? [
          { id: "dominance" as const, label: "Dominio" },
          { id: "duel" as const, label: "Duelo" },
        ]
      : []),
  ];

  // En duelo solo se dibujan los dos pilotos comparados
  const shown =
    duelOn && duel
      ? telemetry.filter((t) => t.driver === duel.ref.driver || t.driver === duel.rival.driver)
      : telemetry;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          ariaLabel="Capa del mapa"
          size="sm"
          segments={modes}
          value={mode}
          onChange={setMode}
        />
        <div className="flex items-center gap-1" role="group" aria-label="Cámara">
          <button
            type="button"
            onClick={() => setFollow(null)}
            aria-pressed={followed == null}
            aria-label="Vista completa"
            title="Vista completa"
            className={`pressable flex h-8 w-8 items-center justify-center rounded-full ${followed == null ? "bg-white/[0.14] text-white" : "fill-control text-ink-3 hover:text-ink"}`}
          >
            <Maximize2 size={14} />
          </button>
          <button
            type="button"
            onClick={() =>
              setFollow((f) => (f ? null : duelOn && duel ? duel.ref.driver : ref.driver))
            }
            aria-pressed={followed != null}
            title="Cámara que sigue al piloto"
            className={`pressable flex h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-bold uppercase tracking-wider ${followed ? "bg-white/[0.14] text-white" : "fill-control text-ink-3 hover:text-ink"}`}
          >
            <Focus size={13} />
            {followed ?? "Seguir"}
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[22px] bg-black/30 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.05)]">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${geo.frame.height}`}
          className="block w-full cursor-crosshair touch-none select-none"
          role="img"
          aria-label="Mapa del circuito con la posición de los pilotos"
          style={{ "--inv": 1 } as React.CSSProperties}
          onPointerDown={(e) => {
            draggingRef.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            scrub(indexFromPointer(e.clientX, e.clientY));
          }}
          onPointerMove={(e) => {
            if (draggingRef.current) scrub(indexFromPointer(e.clientX, e.clientY));
          }}
          onPointerUp={(e) => {
            draggingRef.current = false;
            try {
              e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {
              /* captura ya perdida (gesto táctil interrumpido) */
            }
          }}
          onPointerCancel={() => {
            draggingRef.current = false;
          }}
          onDoubleClick={() => scrub(null)}
        >
          <MapDefs />
          <g ref={cameraRef}>
            <StaticTrack geo={geo} overlay={overlay} />
            {/* Marcadores: el bucle rAF solo actualiza su transform */}
            {[...shown].reverse().map((t) => {
              const color = colorOf(t.driver);
              const isRef = duelOn && duel ? t.driver === duel.ref.driver : t.driver === ref.driver;
              const ghost = duelOn && duel && t.driver === duel.rival.driver;
              return (
                <g
                  key={t.driver}
                  ref={(el) => {
                    if (el) markerRefs.current.set(t.driver, el);
                    else markerRefs.current.delete(t.driver);
                  }}
                  className="pointer-events-none"
                >
                  <g style={{ transform: "scale(var(--inv))" }}>
                    {ghost ? (
                      <>
                        <circle
                          r={11}
                          fill="none"
                          stroke={color}
                          strokeWidth={1.5}
                          strokeDasharray="3 3"
                          opacity={0.9}
                        />
                        <circle
                          r={6.5}
                          fill={color}
                          fillOpacity={0.35}
                          stroke={color}
                          strokeWidth={2}
                        />
                      </>
                    ) : (
                      <>
                        <circle r={isRef ? 13 : 11} fill={color} opacity={0.22} />
                        <circle
                          r={isRef ? 7.5 : 6.5}
                          fill={color}
                          stroke="#fff"
                          strokeWidth={2.5}
                        />
                      </>
                    )}
                    <g transform="translate(10 -12)">
                      <rect
                        x={0}
                        y={-8}
                        width={30}
                        height={15}
                        rx={7.5}
                        fill="rgb(10 10 15 / 0.88)"
                        stroke={color}
                        strokeWidth={1.2}
                      />
                      <text
                        x={15}
                        y={3}
                        textAnchor="middle"
                        fontSize={8.5}
                        fontWeight={800}
                        fill="#fff"
                      >
                        {t.driver}
                      </text>
                    </g>
                    {ghost && (
                      <g transform="translate(10 6)">
                        <rect
                          ref={gapBgRef}
                          x={0}
                          y={-7}
                          width={40}
                          height={14}
                          rx={7}
                          fill={color}
                        />
                        <text
                          ref={gapTextRef}
                          x={5}
                          y={3}
                          fontSize={8}
                          fontWeight={800}
                          fill="#0a0a0f"
                        />
                      </g>
                    )}
                  </g>
                </g>
              );
            })}
          </g>
        </svg>

        <MapLegend overlay={overlay} colorOf={colorOf} />
      </div>

      {multi && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Seguir a un piloto">
          {shown.map((t) => (
            <button
              key={t.driver}
              type="button"
              aria-pressed={followed === t.driver}
              onClick={() => setFollow((f) => (f === t.driver ? null : t.driver))}
              className={`pressable flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-bold ${followed === t.driver ? "bg-white/[0.14] text-white" : "fill-control text-ink-2 hover:text-white"}`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: colorOf(t.driver) }} />
              {t.driver}
            </button>
          ))}
          <span className="self-center pl-1 text-[10px] text-ink-3">
            {duelOn
              ? "distancia del rival respecto a la referencia, al mismo instante"
              : "toca para seguir con la cámara"}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Trazado oficial estático (sin coches) para sesiones sin datos de posición:
 * silueta, curvas y meta de MultiViewer con la rotación de la retransmisión.
 */
export function CircuitOutline({ circuit }: { circuit: CircuitInfo }) {
  const geo = useMemo(() => {
    const outline = circuit.outline!;
    const frame = makeFrame([outline], circuit.rotation, W, H_RANGE, PAD);
    const pts = decimate(
      outline.x.map((x, i) => frame.project(x, outline.y[i])),
      1.2,
    );
    return {
      frame,
      basePath: smoothPath(pts, true),
      corners: projectCorners(circuit, frame),
      ...finishLine(pts),
    };
  }, [circuit]);
  return (
    <div className="relative overflow-hidden rounded-[22px] bg-black/30 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.05)]">
      <svg
        viewBox={`0 0 ${W} ${geo.frame.height}`}
        className="block w-full"
        role="img"
        aria-label="Trazado oficial del circuito"
      >
        <MapDefs />
        <g style={{ "--inv": 1 } as React.CSSProperties}>
          <StaticTrack geo={geo} overlay={{ segs: [], legend: { kind: "none" } }} />
        </g>
      </svg>
      <div className="pointer-events-none absolute inset-x-2 bottom-2 flex justify-center">
        <p className="glass rounded-full px-3 py-1.5 text-center text-[10px] font-semibold text-ink-2">
          Trazado oficial · esta sesión aún no tiene datos de posición de los coches
        </p>
      </div>
    </div>
  );
}

function MapDefs() {
  return (
    <defs>
      <filter id="dz-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="6" />
      </filter>
      <pattern id="dz-checker" width="4" height="4" patternUnits="userSpaceOnUse">
        <rect width="4" height="4" fill="#fff" />
        <rect width="2" height="2" fill="#111" />
        <rect x="2" y="2" width="2" height="2" fill="#111" />
      </pattern>
    </defs>
  );
}

type Geo = {
  basePath: string;
  corners: { key: string; label: string; x: number; y: number; ax: number; ay: number }[];
  finish: { x1: number; y1: number; x2: number; y2: number };
  dirAngle: number;
  p0: Pt;
};
type Seg = { d: string; color: string; opacity?: number };
type Overlay = {
  segs: Seg[];
  drs?: string[];
  legend:
    | { kind: "speed"; min: number; max: number }
    | { kind: "dominance"; shares: { driver: string; pct: number }[] }
    | { kind: "duel"; ref: string; rival: string; refColor: string; rivalColor: string }
    | { kind: "sectors"; exact: boolean }
    | { kind: "none" };
};

/** Capas que no dependen del cursor: memoizadas para no re-pintarse nunca durante la reproducción. */
const StaticTrack = memo(function StaticTrack({ geo, overlay }: { geo: Geo; overlay: Overlay }) {
  return (
    <>
      {/* Halo + borde + asfalto */}
      <path
        d={geo.basePath}
        fill="none"
        stroke="rgb(255 255 255 / 0.07)"
        strokeWidth={22}
        strokeLinejoin="round"
        filter="url(#dz-glow)"
      />
      <path
        d={geo.basePath}
        fill="none"
        stroke="#3a3a48"
        strokeWidth={15}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={geo.basePath}
        fill="none"
        stroke="#101017"
        strokeWidth={11}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* Capa de color sobre el asfalto */}
      <g opacity={0.95}>
        {overlay.segs.map((s, i) => (
          <path
            key={i}
            d={s.d}
            fill="none"
            stroke={s.color}
            strokeOpacity={s.opacity ?? 1}
            strokeWidth={3.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
      {overlay.drs?.map((d, i) => (
        <path
          key={`drs-${i}`}
          d={d}
          fill="none"
          stroke="#22c55e"
          strokeWidth={9}
          strokeOpacity={0.22}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {/* Meta + sentido de la marcha */}
      <line {...geo.finish} stroke="url(#dz-checker)" strokeWidth={5} />
      <g
        transform={`translate(${geo.p0.x} ${geo.p0.y}) rotate(${geo.dirAngle}) translate(18 0)`}
        opacity={0.7}
      >
        <path
          d="M-3,-4 L3,0 L-3,4"
          fill="none"
          stroke="#fff"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* Curvas */}
      {geo.corners.map((c) => (
        <g key={c.key} className="pointer-events-none">
          <line
            x1={c.ax}
            y1={c.ay}
            x2={c.x}
            y2={c.y}
            stroke="rgb(255 255 255 / 0.14)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <g transform={`translate(${c.x} ${c.y})`}>
            <g style={{ transform: "scale(var(--inv))" }}>
              <circle
                r={c.label.length > 2 ? 10 : 8.5}
                fill="rgb(20 20 28 / 0.92)"
                stroke="rgb(255 255 255 / 0.2)"
                strokeWidth={1}
              />
              <text y={3.2} textAnchor="middle" fontSize={9} fontWeight={700} fill="#d4d4dc">
                {c.label}
              </text>
            </g>
          </g>
        </g>
      ))}
    </>
  );
});

function MapLegend({ overlay, colorOf }: { overlay: Overlay; colorOf: (a: string) => string }) {
  const l = overlay.legend;
  if (l.kind === "none") return null;
  return (
    <div className="pointer-events-none absolute inset-x-2 bottom-2 flex justify-center">
      <div className="glass flex items-center gap-3 rounded-full px-3 py-1.5 text-[10px] font-semibold text-ink-2">
        {l.kind === "sectors" && (
          <>
            {SECTOR_COLORS.map((c, i) => (
              <span key={c} className="flex items-center gap-1.5">
                <span className="h-1.5 w-4 rounded-full" style={{ background: c }} />S{i + 1}
              </span>
            ))}
            {overlay.drs && overlay.drs.length > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-4 rounded-full bg-green-500/50" />
                DRS
              </span>
            )}
            {!l.exact && <span className="text-ink-3">· aprox.</span>}
          </>
        )}
        {l.kind === "speed" && (
          <>
            <span className="tabular-nums">{l.min}</span>
            <span
              className="h-1.5 w-24 rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, hsl(225 90% 52%), hsl(112 90% 55%), hsl(56 90% 56%), hsl(0 90% 58%))",
              }}
            />
            <span className="tabular-nums">{l.max} km/h</span>
          </>
        )}
        {l.kind === "dominance" &&
          l.shares.map((s) => (
            <span key={s.driver} className="flex items-center gap-1.5">
              <span className="h-1.5 w-4 rounded-full" style={{ background: colorOf(s.driver) }} />
              {s.driver} <span className="tabular-nums text-ink-3">{s.pct}%</span>
            </span>
          ))}
        {l.kind === "duel" && (
          <>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-4 rounded-full" style={{ background: l.refColor }} />
              gana {l.ref}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-4 rounded-full" style={{ background: l.rivalColor }} />
              gana {l.rival}
            </span>
            <span className="text-ink-3">· intensidad = tiempo ganado</span>
          </>
        )}
      </div>
    </div>
  );
}
