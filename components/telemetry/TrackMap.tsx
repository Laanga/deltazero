"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useCallback, useMemo, useRef } from "react";

import type { Corner, TelemetryData } from "@/lib/types";

gsap.registerPlugin(useGSAP);

const W = 460;
const H = 400;
const PAD = 36;

interface TrackMapProps {
  reference: TelemetryData;
  corners: Corner[];
  hoverIdx: number | null;
  onHover: (idx: number | null) => void;
}

export function TrackMap({ reference, corners, hoverIdx, onHover }: TrackMapProps) {
  const ref = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);

  const geo = useMemo(() => {
    // El componente solo se monta cuando hay datos de posición (lo garantiza TelemetryView)
    const { x, y } = reference.track!;
    const minX = Math.min(...x), maxX = Math.max(...x);
    const minY = Math.min(...y), maxY = Math.max(...y);
    const scale = Math.min((W - PAD * 2) / (maxX - minX), (H - PAD * 2) / (maxY - minY));
    const offX = (W - (maxX - minX) * scale) / 2;
    const offY = (H - (maxY - minY) * scale) / 2;

    const project = (px: number, py: number) => ({
      x: offX + (px - minX) * scale,
      // Y invertida: las coordenadas de FastF1 crecen hacia arriba
      y: H - (offY + (py - minY) * scale),
    });

    const points = x.map((_, i) => project(x[i], y[i]));
    const path = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ") + " Z";
    return { points, path, project };
  }, [reference]);

  // Etiquetas de curva desplazadas hacia fuera del trazado (desde el centroide)
  const projectedCorners = useMemo(() => {
    const pts = geo.points;
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    return corners.map((c) => {
      const p = geo.project(c.x, c.y);
      const dx = p.x - cx;
      const dy = p.y - cy;
      const len = Math.hypot(dx, dy) || 1;
      const OFFSET = 16;
      return { ...c, x: p.x + (dx / len) * OFFSET, y: p.y + (dy / len) * OFFSET };
    });
  }, [corners, geo]);

  const indexFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const svg = ref.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      const px = ((clientX - rect.left) / rect.width) * W;
      const py = ((clientY - rect.top) / rect.height) * H;
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < geo.points.length; i++) {
        const dx = geo.points[i].x - px;
        const dy = geo.points[i].y - py;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return best;
    },
    [geo],
  );

  // Coche fantasma en bucle mientras no hay interacción
  useGSAP(
    () => {
      const dot = ref.current?.querySelector<SVGCircleElement>(".ghost-car");
      if (!dot || hoverIdx != null) return;
      const proxy = { t: 0 };
      gsap.to(proxy, {
        t: 1,
        duration: Math.min((reference.lap_time ?? 90) / 4, 25),
        repeat: -1,
        ease: "none",
        onUpdate: () => {
          const i = Math.min(Math.floor(proxy.t * geo.points.length), geo.points.length - 1);
          dot.setAttribute("cx", String(geo.points[i].x));
          dot.setAttribute("cy", String(geo.points[i].y));
        },
      });
    },
    { dependencies: [reference, hoverIdx == null], scope: ref, revertOnUpdate: true },
  );

  const marker = hoverIdx != null ? geo.points[Math.min(hoverIdx, geo.points.length - 1)] : null;

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full touch-none cursor-crosshair select-none"
      onPointerDown={(e) => {
        draggingRef.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        onHover(indexFromPointer(e.clientX, e.clientY));
      }}
      onPointerMove={(e) => {
        if (draggingRef.current) onHover(indexFromPointer(e.clientX, e.clientY));
      }}
      onPointerUp={(e) => {
        draggingRef.current = false;
        // La captura puede haberse perdido ya (gesto táctil interrumpido)
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {}
      }}
      onPointerCancel={() => {
        draggingRef.current = false;
      }}
      onDoubleClick={() => onHover(null)}
    >
      {/* Silueta del circuito: borde claro + asfalto oscuro encima */}
      <path d={geo.path} fill="none" stroke="#4a4a56" strokeWidth={13} strokeLinejoin="round" strokeLinecap="round" />
      <path d={geo.path} fill="none" stroke="#0d0d13" strokeWidth={9} strokeLinejoin="round" strokeLinecap="round" />

      {projectedCorners.map((c) => (
        <g key={`${c.number}${c.letter}`} className="pointer-events-none">
          <text
            x={c.x} y={c.y + 2.5}
            textAnchor="middle"
            fontSize={7.5}
            fontWeight={600}
            fill="#8b8b96"
            stroke="#0a0a0f"
            strokeWidth={2.5}
            paintOrder="stroke"
          >
            {c.number}{c.letter}
          </text>
        </g>
      ))}

      {hoverIdx == null && (
        <circle className="ghost-car pointer-events-none" r={7} fill="#fff" stroke="#e10600" strokeWidth={3}>
          <animate attributeName="opacity" values="1;0.55;1" dur="1s" repeatCount="indefinite" />
        </circle>
      )}

      {marker && (
        <g className="pointer-events-none">
          <circle cx={marker.x} cy={marker.y} r={16} fill="#e10600" opacity={0.18}>
            <animate attributeName="r" values="12;20;12" dur="1.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.28;0.08;0.28" dur="1.4s" repeatCount="indefinite" />
          </circle>
          <circle cx={marker.x} cy={marker.y} r={14} fill="none" stroke="#e10600" strokeWidth={2.5} opacity={0.6}>
            <animate attributeName="r" values="11;16;11" dur="1.4s" repeatCount="indefinite" />
          </circle>
          <circle cx={marker.x} cy={marker.y} r={7.5} fill="#fff" stroke="#e10600" strokeWidth={3.5} />
        </g>
      )}
    </svg>
  );
}
