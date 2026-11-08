/**
 * Geometría del mapa de circuito: rotación oficial, encaje en el lienzo,
 * suavizado del trazado y utilidades de proyección. Funciones puras.
 */
import { lowerBound } from "./f1math";
import type { TelemetryData } from "./types";

export interface Pt {
  x: number;
  y: number;
}

export interface TrackFrame {
  /** Coordenadas de pista (OpenF1 / MultiViewer) → lienzo SVG. */
  project: (x: number, y: number) => Pt;
  width: number;
  height: number;
}

/**
 * Prepara la proyección: rota los puntos con la rotación oficial (la de la
 * retransmisión), encaja el resultado en width×height con margen e invierte
 * Y (en pista crece hacia arriba; en SVG hacia abajo).
 */
export function makeFrame(
  clouds: { x: number[]; y: number[] }[],
  rotationDeg: number,
  width: number,
  /** Alto fijo, o rango [min, max] para ajustarlo a la proporción del trazado. */
  heightSpec: number | [number, number],
  pad: number,
): TrackFrame {
  const a = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const rot = (x: number, y: number): Pt => ({ x: x * cos - y * sin, y: x * sin + y * cos });

  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const c of clouds) {
    for (let i = 0; i < c.x.length; i++) {
      const p = rot(c.x[i], c.y[i]);
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const height =
    typeof heightSpec === "number"
      ? heightSpec
      : Math.round(
          Math.min(
            heightSpec[1],
            Math.max(heightSpec[0], (spanY / spanX) * (width - pad * 2) + pad * 2),
          ),
        );
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;

  return {
    width,
    height,
    project: (x, y) => {
      const p = rot(x, y);
      return { x: offX + (p.x - minX) * scale, y: height - (offY + (p.y - minY) * scale) };
    },
  };
}

/** Polilínea suavizada con Catmull-Rom → Bézier cúbicas (trazado sin aristas). */
export function smoothPath(points: Pt[], closed = true, tension = 0.5): string {
  const n = points.length;
  if (n < 2) return "";
  const at = (i: number) =>
    closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))];
  let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1),
      p1 = at(i),
      p2 = at(i + 1),
      p3 = at(i + 2);
    const k = tension / 3;
    const c1x = p1.x + (p2.x - p0.x) * k;
    const c1y = p1.y + (p2.y - p0.y) * k;
    const c2x = p2.x - (p3.x - p1.x) * k;
    const c2y = p2.y - (p3.y - p1.y) * k;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return closed ? d + " Z" : d;
}

/** Reduce puntos casi coincidentes (menos nodos en el SVG, mismo dibujo). */
export function decimate(points: Pt[], minDist: number): Pt[] {
  if (points.length < 3) return points;
  const out = [points[0]];
  const min2 = minDist * minDist;
  for (let i = 1; i < points.length; i++) {
    const prev = out[out.length - 1];
    const dx = points[i].x - prev.x;
    const dy = points[i].y - prev.y;
    if (dx * dx + dy * dy >= min2) out.push(points[i]);
  }
  return out;
}

/** Índice del punto más cercano a (x, y). */
export function nearestIndex(points: Pt[], x: number, y: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < points.length; i++) {
    const dx = points[i].x - x;
    const dy = points[i].y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Índice de la rejilla de un piloto en el instante t (s desde el inicio de su vuelta). */
export function indexAtTime(t: TelemetryData, time: number): number {
  const tc = t.channels.time;
  return Math.min(tc.length - 1, lowerBound(tc, time));
}

/**
 * Minisectores de dominio: divide la vuelta en `n` tramos por fracción de
 * distancia y devuelve, para cada tramo, el piloto que lo recorrió en menos
 * tiempo. Se normaliza por la longitud de cada piloto (la integración de la
 * velocidad da longitudes de vuelta ligeramente distintas).
 */
export function dominance(
  telemetry: TelemetryData[],
  n = 24,
): { from: number; to: number; driver: string }[] {
  if (telemetry.length < 2) return [];
  const out: { from: number; to: number; driver: string }[] = [];
  const timeAtFrac = (t: TelemetryData, f: number) => {
    const { time } = t.channels;
    const pos = f * (time.length - 1);
    const i = Math.floor(pos);
    const j = Math.min(time.length - 1, i + 1);
    return time[i] + (time[j] - time[i]) * (pos - i);
  };
  for (let k = 0; k < n; k++) {
    const f0 = k / n;
    const f1 = (k + 1) / n;
    let best = "";
    let bestDt = Infinity;
    for (const t of telemetry) {
      const dt = timeAtFrac(t, f1) - timeAtFrac(t, f0);
      if (dt < bestDt) {
        bestDt = dt;
        best = t.driver;
      }
    }
    out.push({ from: f0, to: f1, driver: best });
  }
  return out;
}

/** Color de velocidad: azul (lento) → verde → amarillo → rojo (rápido). */
export function speedColor(speed: number, min: number, max: number): string {
  const t = Math.max(0, Math.min(1, (speed - min) / Math.max(1, max - min)));
  const hue = 225 - 225 * t;
  return `hsl(${hue.toFixed(0)} 90% ${(52 + 6 * t).toFixed(0)}%)`;
}
