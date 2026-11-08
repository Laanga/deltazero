/**
 * Transformaciones puras sobre datos de F1 (sin red ni DOM): testeables de forma aislada.
 */
import type { RaceGaps, RacePositions, TrackEvent } from "./types";

/* ------------------------------------------------------------------ */
/* Búsqueda e interpolación                                            */
/* ------------------------------------------------------------------ */

/** Primer índice i tal que arr[i] >= value (arr ordenado ascendente). */
export function lowerBound(arr: ArrayLike<number>, value: number): number {
  let lo = 0;
  let hi = arr.length - 1;
  if (hi < 0) return 0;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Interpolación lineal de (x, y) sobre `grid` (equivalente a np.interp). `x` ascendente. */
export function interp(grid: number[], x: number[], y: number[]): number[] {
  const out = new Array<number>(grid.length);
  if (x.length === 0) return out.fill(NaN);
  let j = 0;
  for (let i = 0; i < grid.length; i++) {
    const g = grid[i];
    if (g <= x[0]) {
      out[i] = y[0];
      continue;
    }
    if (g >= x[x.length - 1]) {
      out[i] = y[y.length - 1];
      continue;
    }
    while (x[j + 1] < g) j++;
    const span = x[j + 1] - x[j];
    const t = span === 0 ? 0 : (g - x[j]) / span;
    out[i] = y[j] + t * (y[j + 1] - y[j]);
  }
  return out;
}

/** Agrupa una lista por clave numérica conservando el orden de entrada. */
export function groupBy<T>(list: T[], key: (item: T) => number): Map<number, T[]> {
  const out = new Map<number, T[]>();
  for (const item of list) {
    const k = key(item);
    const arr = out.get(k);
    if (arr) arr.push(item);
    else out.set(k, [item]);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Fechas                                                              */
/* ------------------------------------------------------------------ */

/** ISO → "YYYY-MM-DD HH:MM:SS" en UTC. */
export function toUtcStr(iso: string): string {
  return new Date(iso).toISOString().slice(0, 19).replace("T", " ");
}

/** Suma el gmt_offset ("02:00:00" / "-04:00:00") y formatea con sufijo de offset. */
export function toLocalStr(iso: string, gmtOffset: string): string {
  const sign = gmtOffset.startsWith("-") ? -1 : 1;
  const [h, m] = gmtOffset.replace("-", "").split(":").map(Number);
  const offsetMs = sign * (h * 3600 + m * 60) * 1000;
  const local = new Date(new Date(iso).getTime() + offsetMs);
  const base = local.toISOString().slice(0, 19).replace("T", " ");
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return `${base}${sign < 0 ? "-" : "+"}${hh}:${mm}`;
}

/** Duración de carrera en segundos → "1:32:05.123" o "58:01.004". */
export function formatRaceDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const ss = (seconds % 60).toFixed(3).padStart(6, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/* ------------------------------------------------------------------ */
/* Vueltas, posiciones y gaps                                          */
/* ------------------------------------------------------------------ */

export interface LapTiming {
  driver_number: number;
  lap_number: number;
  date_start: string | null;
  lap_duration: number | null;
}

/**
 * Para cada piloto, instante absoluto (ms) en que termina cada vuelta.
 * Fin de la vuelta N = date_start de la vuelta N+1 (robusto ante lap_duration
 * nulos, como la vuelta 1 con salida parada).
 */
export function lapEndTimes(laps: LapTiming[]): Map<number, Map<number, number>> {
  const out = new Map<number, Map<number, number>>();
  for (const [num, list] of groupBy(laps, (l) => l.driver_number)) {
    const sorted = [...list].sort((a, b) => a.lap_number - b.lap_number);
    const ends = new Map<number, number>();
    for (let i = 0; i < sorted.length; i++) {
      const cur = sorted[i];
      const next = sorted[i + 1];
      if (next?.date_start) {
        ends.set(cur.lap_number, Date.parse(next.date_start));
      } else if (cur.date_start && cur.lap_duration != null) {
        ends.set(cur.lap_number, Date.parse(cur.date_start) + cur.lap_duration * 1000);
      }
    }
    out.set(num, ends);
  }
  return out;
}

/**
 * Posiciones y gap al líder por vuelta, en una sola pasada: el orden de paso
 * por meta al final de cada vuelta da la posición y la diferencia con el
 * primero, el gap.
 */
export function raceProgress(
  laps: LapTiming[],
  acronymOf: (driverNumber: number) => string | undefined,
): { positions: RacePositions[]; gaps: RaceGaps[] } {
  const ends = lapEndTimes(laps);
  let maxLap = 0;
  for (const l of laps) if (l.lap_number > maxLap) maxLap = l.lap_number;

  const positions: RacePositions[] = [];
  const gaps: RaceGaps[] = [];
  for (let lapN = 1; lapN <= maxLap; lapN++) {
    const finishers: { acr: string; t: number }[] = [];
    for (const [num, lapEnds] of ends) {
      const t = lapEnds.get(lapN);
      const acr = acronymOf(num);
      if (t != null && acr) finishers.push({ acr, t });
    }
    if (!finishers.length) continue;
    finishers.sort((a, b) => a.t - b.t);
    const leader = finishers[0].t;
    const pos: Record<string, number> = {};
    const gap: Record<string, number> = {};
    finishers.forEach((f, i) => {
      pos[f.acr] = i + 1;
      gap[f.acr] = Math.round(f.t - leader) / 1000;
    });
    positions.push({ lap: lapN, positions: pos });
    gaps.push({ lap: lapN, gaps: gap });
  }
  return { positions, gaps };
}

/* ------------------------------------------------------------------ */
/* Dirección de carrera                                                */
/* ------------------------------------------------------------------ */

export interface RaceControlMessage {
  date: string;
  lap_number: number | null;
  flag: string | null;
  message: string | null;
}

/** Vueltas afectadas por SC / VSC / bandera roja a partir de los mensajes de dirección de carrera. */
export function parseRaceControl(messages: RaceControlMessage[]): TrackEvent[] {
  const rc = [...messages].sort((a, b) => a.date.localeCompare(b.date));
  const events = new Map<number, Set<string>>();
  const mark = (lap: number | null, label: string) => {
    if (lap == null) return;
    const set = events.get(lap) ?? new Set<string>();
    set.add(label);
    events.set(lap, set);
  };
  const markRange = (from: number | null, to: number | null, label: string) => {
    if (from == null) return;
    for (let l = from; l <= (to ?? from); l++) mark(l, label);
  };

  let scStart: number | null = null;
  let vscStart: number | null = null;
  for (const r of rc) {
    const msg = (r.message ?? "").toUpperCase();
    // El orden importa: "VIRTUAL SAFETY CAR DEPLOYED" también contiene "SAFETY CAR DEPLOYED"
    if (msg.includes("VIRTUAL SAFETY CAR DEPLOYED")) {
      vscStart = r.lap_number;
    } else if (msg.includes("VIRTUAL SAFETY CAR ENDING")) {
      markRange(vscStart, r.lap_number, "VSC");
      vscStart = null;
    } else if (msg.includes("SAFETY CAR DEPLOYED")) {
      scStart = r.lap_number;
    } else if (msg.includes("SAFETY CAR IN THIS LAP")) {
      markRange(scStart, r.lap_number, "SC");
      scStart = null;
    } else if (r.flag === "RED") {
      mark(r.lap_number, "RED");
    }
  }
  // Periodos sin cierre registrado
  if (scStart != null) mark(scStart, "SC");
  if (vscStart != null) mark(vscStart, "VSC");

  return [...events.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([lap, evs]) => ({ lap, events: [...evs].sort() }));
}

/* ------------------------------------------------------------------ */
/* Telemetría                                                          */
/* ------------------------------------------------------------------ */

/** Distancia acumulada (m) integrando la velocidad (km/h) por trapecios sobre tiempos (s). */
export function integrateDistance(times: number[], speedKmh: number[]): number[] {
  const dist = new Array<number>(times.length).fill(0);
  for (let i = 1; i < times.length; i++) {
    const dt = times[i] - times[i - 1];
    dist[i] = dist[i - 1] + (((speedKmh[i] + speedKmh[i - 1]) / 2) * dt) / 3.6;
  }
  return dist;
}

export const round1 = (v: number) => Math.round(v * 10) / 10;
export const round3 = (v: number) => Math.round(v * 1000) / 1000;
