/**
 * Comparador de vuelta (duelo entre dos pilotos). Funciones puras.
 *
 * Alineación: cada piloto integra su propia distancia desde la velocidad, así
 * que sus "metros" no coinciden exactamente (Spa: 6938 m vs 6929 m), y el error
 * no es uniforme: se concentra en frenadas y curvas lentas. Comparar metro a
 * metro, o por fracción de toda la vuelta, deja desfases de hasta ~0,1 s.
 *
 * Por eso se alinea POR TRAMOS con anclajes físicos comunes: la meta (inicio y
 * fin) y las dos líneas de sector oficiales. Entre anclajes, interpolación
 * lineal. Así el delta coincide exactamente con la diferencia oficial en cada
 * línea de sector y al final de la vuelta. Sin tiempos de sector, se usa la
 * fracción de vuelta completa.
 */
import { lowerBound, valueAtDistance } from "./f1math";
import type { TelemetryData } from "./types";

export const lapLength = (t: TelemetryData) =>
  t.channels.distance[t.channels.distance.length - 1] || 1;

/** Distancia recorrida (m) en el instante `t` (s desde el inicio de su vuelta). */
export function distanceAtTime(t: TelemetryData, time: number): number {
  return valueAtDistance(t.channels.time, t.channels.distance, time);
}

/** Distancias de los anclajes físicos de la vuelta: meta, línea S1→S2, línea S2→S3, meta. */
export function lapAnchors(t: TelemetryData): number[] {
  const L = lapLength(t);
  const s = t.sectors;
  if (s?.s1 != null && s.s2 != null) {
    const a1 = distanceAtTime(t, s.s1);
    const a2 = distanceAtTime(t, s.s1 + s.s2);
    // Solo si son coherentes (crecientes y dentro de la vuelta)
    if (a1 > 0 && a2 > a1 && a2 < L) return [0, a1, a2, L];
  }
  return [0, L];
}

/** Interpolación lineal por tramos entre anclajes (ambos arrays crecientes y de igual longitud). */
function piecewise(fromAnchors: number[], toAnchors: number[], d: number): number {
  const n = fromAnchors.length;
  if (d <= 0) return 0;
  if (d >= fromAnchors[n - 1]) return toAnchors[n - 1] * (d / fromAnchors[n - 1]);
  let k = 1;
  while (k < n - 1 && d > fromAnchors[k]) k++;
  const f = (d - fromAnchors[k - 1]) / (fromAnchors[k] - fromAnchors[k - 1]);
  return toAnchors[k - 1] + f * (toAnchors[k] - toAnchors[k - 1]);
}

const anchorCache = new WeakMap<TelemetryData, number[]>();
function anchorsOf(t: TelemetryData): number[] {
  let a = anchorCache.get(t);
  if (!a) {
    a = lapAnchors(t);
    anchorCache.set(t, a);
  }
  return a;
}

/** Traslada una distancia de la vuelta de `from` al punto físico equivalente de la vuelta de `to`. */
export function mapDistance(from: TelemetryData, to: TelemetryData, d: number): number {
  if (from === to) return d;
  let a = anchorsOf(from);
  let b = anchorsOf(to);
  // Ambos necesitan los mismos anclajes; si a uno le faltan sectores, solo meta
  if (a.length !== b.length) {
    a = [0, lapLength(from)];
    b = [0, lapLength(to)];
  }
  return piecewise(a, b, d);
}

/** Distancia del rival equivalente a la distancia `dRef` de la referencia. */
export function alignedDistance(ref: TelemetryData, other: TelemetryData, dRef: number): number {
  return mapDistance(ref, other, dRef);
}

/** Índice de la rejilla del rival más cercano al punto `idx` de la referencia. */
export function alignedIndex(ref: TelemetryData, other: TelemetryData, idx: number): number {
  if (ref === other) return Math.min(idx, ref.channels.distance.length - 1);
  const dRef = ref.channels.distance[Math.min(idx, ref.channels.distance.length - 1)];
  const d = alignedDistance(ref, other, dRef);
  const dist = other.channels.distance;
  const j = lowerBound(dist, d);
  return j > 0 && Math.abs(dist[j - 1] - d) < Math.abs(dist[j] - d) ? j - 1 : j;
}

/** Valor de un canal del rival en el punto equivalente al índice `idx` de la referencia. */
export function alignedValue(
  ref: TelemetryData,
  other: TelemetryData,
  channel: keyof TelemetryData["channels"],
  idx: number,
): number {
  const i = Math.min(idx, ref.channels.distance.length - 1);
  if (ref === other) return ref.channels[channel][i];
  const d = alignedDistance(ref, other, ref.channels.distance[i]);
  return valueAtDistance(other.channels.distance, other.channels[channel], d);
}

/**
 * Delta en cada punto de la referencia: tiempo del rival al llegar al mismo
 * punto de la vuelta menos tiempo de la referencia. Positivo = el rival va por
 * detrás (pierde); negativo = va por delante.
 */
export function deltaSeries(ref: TelemetryData, rival: TelemetryData): number[] {
  const { distance, time } = ref.channels;
  return distance.map(
    (d, i) =>
      valueAtDistance(rival.channels.distance, rival.channels.time, mapDistance(ref, rival, d)) -
      time[i],
  );
}

/**
 * Separación en pista al mismo instante de vuelta, en metros de la vuelta de
 * referencia. Positivo = el rival va por delante.
 */
export function gapMetersAtTime(ref: TelemetryData, rival: TelemetryData, time: number): number {
  const dRef = distanceAtTime(ref, time);
  const dRival = mapDistance(rival, ref, distanceAtTime(rival, time));
  return dRival - dRef;
}

export interface Zone {
  label: string;
  from: number; // m (vuelta de referencia)
  to: number;
  /** Tiempo que gana la referencia en la zona (s). Negativo = gana el rival. */
  refGain: number;
}

/**
 * Ganancia por zonas: la vuelta se divide en tramos centrados en cada curva
 * oficial (límites a medio camino entre curvas consecutivas). La ganancia de
 * la referencia en un tramo es cuánto crece el delta dentro de él.
 */
export function zoneGains(
  ref: TelemetryData,
  delta: number[],
  corners: { label: string; distance: number }[],
): Zone[] {
  const dist = ref.channels.distance;
  const L = lapLength(ref);
  const sorted = [...corners].sort((a, b) => a.distance - b.distance);
  if (!sorted.length) return [];
  const deltaAt = (d: number) => valueAtDistance(dist, delta, d);
  return sorted.map((c, i) => {
    const prev = sorted[i - 1];
    const next = sorted[i + 1];
    const from = prev ? (prev.distance + c.distance) / 2 : 0;
    const to = next ? (c.distance + next.distance) / 2 : L;
    return { label: c.label, from, to, refGain: deltaAt(to) - deltaAt(from) };
  });
}

/** Segmentos de la vuelta coloreados por quién gana tiempo (capa "Duelo" del mapa). */
export function gainSegments(
  delta: number[],
  n = 60,
): { from: number; to: number; refGain: number }[] {
  const out: { from: number; to: number; refGain: number }[] = [];
  const last = delta.length - 1;
  if (last < 1) return out;
  for (let k = 0; k < n; k++) {
    const i0 = Math.round((k / n) * last);
    const i1 = Math.round(((k + 1) / n) * last);
    out.push({ from: k / n, to: (k + 1) / n, refGain: delta[i1] - delta[i0] });
  }
  return out;
}

export interface SectorDelta {
  sector: 1 | 2 | 3;
  ref: number | null;
  rival: number | null;
  /** rival − ref (s). Positivo = la referencia fue más rápida. */
  diff: number | null;
}

/** Diferencias por sector con los tiempos oficiales de sector. */
export function sectorDeltas(ref: TelemetryData, rival: TelemetryData): SectorDelta[] {
  const keys = ["s1", "s2", "s3"] as const;
  return keys.map((k, i) => {
    const a = ref.sectors?.[k] ?? null;
    const b = rival.sectors?.[k] ?? null;
    return {
      sector: (i + 1) as 1 | 2 | 3,
      ref: a,
      rival: b,
      diff: a != null && b != null ? b - a : null,
    };
  });
}

export interface LapStats {
  topSpeed: number;
  /** % de la vuelta (por distancia) con el acelerador a fondo (≥ 98 %). */
  fullThrottle: number;
  /** % de la vuelta (por distancia) frenando. */
  braking: number;
  /** Velocidad mínima de la vuelta (curva más lenta). */
  minSpeed: number;
}

export function lapStats(t: TelemetryData): LapStats {
  const { speed, throttle, brake } = t.channels;
  const n = speed.length || 1;
  let top = 0,
    min = Infinity,
    full = 0,
    brk = 0;
  for (let i = 0; i < speed.length; i++) {
    if (speed[i] > top) top = speed[i];
    if (speed[i] < min) min = speed[i];
    if (throttle[i] >= 98) full++;
    if (brake[i] > 0) brk++;
  }
  return {
    topSpeed: top,
    minSpeed: min === Infinity ? 0 : min,
    fullThrottle: (full / n) * 100,
    braking: (brk / n) * 100,
  };
}

/* ------------------------------------------------------------------ */
/* Color                                                               */
/* ------------------------------------------------------------------ */

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Color del rival que se distinga del de la referencia. Compañeros de equipo
 * (mismo color) o colores muy parecidos: el rival pasa a un blanco frío.
 */
export function rivalColor(refColor: string, rivalColorHex: string): string {
  const a = hexToRgb(refColor);
  const b = hexToRgb(rivalColorHex);
  if (!a || !b) return rivalColorHex;
  const dist = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  return dist < 90 ? "#e4e4ea" : rivalColorHex;
}
