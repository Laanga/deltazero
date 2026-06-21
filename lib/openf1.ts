/**
 * Cliente OpenF1 (https://openf1.org) — datos de F1 directos desde el navegador.
 *
 * Limitaciones conocidas:
 *  - Datos solo desde 2023.
 *  - Sin corners del circuito (el mapa se dibuja igual desde la telemetría).
 *  - Telemetría a ~3.7 Hz.
 */
import type {
  CircuitInfo,
  LatestRace,
  ConstructorStanding,
  DriverInfo,
  DriverStanding,
  EventInfo,
  LapData,
  RaceGaps,
  RacePositions,
  RaceResult,
  SessionInfo,
  SessionResultRow,
  SessionResults,
  Stint,
  TelemetryData,
  TrackEvent,
} from "./types";

const OF1 = "https://api.openf1.org/v1";
const JOLPICA = "https://api.jolpi.ca/ergast/f1";

// Paso de resampleo de telemetría: un punto cada 5 m
const STEP_METERS = 5;

/* ------------------------------------------------------------------ */
/* Cola de peticiones: OpenF1 limita el ritmo, serializamos con retry  */
/* ------------------------------------------------------------------ */

let queueTail: Promise<unknown> = Promise.resolve();
const GAP_MS = 250;

const inflight = new Map<string, Promise<unknown>>();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function rawFetch(url: string): Promise<unknown> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url);
    if (res.status === 429) {
      // Backoff con tope + jitter para no sincronizar reintentos (thundering herd)
      const backoff = Math.min(1000 * 2 ** attempt, 8000);
      await sleep(backoff + Math.floor(Math.random() * 400));
      continue;
    }
    // OpenF1 responde 404 {"detail": "No results found."} para conjuntos vacíos
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`OpenF1 ${res.status} en ${url}`);
    return res.json();
  }
  throw new Error(`OpenF1: rate limit persistente en ${url}`);
}

/** GET serializado + dedupe de peticiones idénticas en vuelo. */
function of1<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.append(k, String(v));
  const url = `${OF1}/${path}${qs.size ? `?${qs}` : ""}`;

  const existing = inflight.get(url);
  if (existing) return existing as Promise<T>;

  const p = (queueTail = queueTail
    .catch(() => undefined)
    .then(async () => {
      const data = await rawFetch(url);
      await sleep(GAP_MS);
      // OpenF1 devuelve {"detail": "..."} cuando no hay datos
      if (data && !Array.isArray(data)) return [];
      return data;
    })) as Promise<T>;

  inflight.set(url, p);
  // then(fn, fn) en rama aparte: .finally() sobre p crearía una promesa
  // derivada cuyo rechazo nadie maneja (unhandled rejection en cada fallo)
  p.then(
    () => inflight.delete(url),
    () => inflight.delete(url)
  );
  return p;
}

/* ------------------------------------------------------------------ */
/* Tipos crudos de OpenF1                                              */
/* ------------------------------------------------------------------ */

interface Of1Meeting {
  meeting_key: number;
  meeting_name: string;
  meeting_official_name: string;
  location: string;
  country_name: string;
  gmt_offset: string;
  date_start: string;
  year: number;
}

interface Of1Session {
  session_key: number;
  meeting_key: number;
  session_name: string;
  date_start: string;
  gmt_offset: string;
}

interface Of1Driver {
  driver_number: number;
  full_name: string;
  name_acronym: string;
  team_name: string | null;
  team_colour: string | null;
  headshot_url: string | null;
}

interface Of1Lap {
  driver_number: number;
  lap_number: number;
  date_start: string | null;
  lap_duration: number | null;
  duration_sector_1: number | null;
  duration_sector_2: number | null;
  duration_sector_3: number | null;
  is_pit_out_lap: boolean;
}

interface Of1Stint {
  driver_number: number;
  stint_number: number;
  lap_start: number;
  lap_end: number;
  compound: string | null;
  tyre_age_at_start: number | null;
}

interface Of1Pit {
  driver_number: number;
  lap_number: number;
}

interface Of1CarData {
  date: string;
  speed: number;
  rpm: number;
  throttle: number;
  brake: number;
  n_gear: number;
  drs: number | null;
}

interface Of1Location {
  date: string;
  x: number;
  y: number;
}

interface Of1RaceControl {
  date: string;
  lap_number: number | null;
  category: string | null;
  flag: string | null;
  message: string | null;
}

interface Of1SessionResult {
  position: number | null;
  driver_number: number;
  number_of_laps: number | null;
  points?: number | null;
  dnf: boolean;
  dns: boolean;
  dsq: boolean;
  duration: number | number[] | null;
  gap_to_leader: number | string | (number | null)[] | null;
}

interface Of1Grid {
  driver_number: number;
  position: number;
}

/* ------------------------------------------------------------------ */
/* Helpers de fechas                                                   */
/* ------------------------------------------------------------------ */

/** ISO de OpenF1 → "YYYY-MM-DD HH:MM:SS" en UTC. */
function toUtcStr(iso: string): string {
  return new Date(iso).toISOString().slice(0, 19).replace("T", " ");
}

/** Suma el gmt_offset ("02:00:00" / "-04:00:00") y formatea con sufijo de offset. */
function toLocalStr(iso: string, gmtOffset: string): string {
  const sign = gmtOffset.startsWith("-") ? -1 : 1;
  const [h, m] = gmtOffset.replace("-", "").split(":").map(Number);
  const offsetMs = sign * (h * 3600 + m * 60) * 1000;
  const local = new Date(new Date(iso).getTime() + offsetMs);
  const base = local.toISOString().slice(0, 19).replace("T", " ");
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return `${base}${sign < 0 ? "-" : "+"}${hh}:${mm}`;
}

/* ------------------------------------------------------------------ */
/* Resolución de meetings y sesiones (con caché)                       */
/* ------------------------------------------------------------------ */

const SESSION_CODES: Record<string, string> = {
  "Practice 1": "FP1",
  "Practice 2": "FP2",
  "Practice 3": "FP3",
  Qualifying: "Q",
  "Sprint Qualifying": "SQ",
  "Sprint Shootout": "SQ",
  Sprint: "Sprint",
  Race: "R",
};

interface YearData {
  meetings: Of1Meeting[];
  sessionsByMeeting: Map<number, Of1Session[]>;
}

/**
 * Memoiza una promesa por clave. Si la promesa falla se desaloja de la caché:
 * sin esto, un fallo transitorio (red, 429 agotado) queda envenenando la
 * entrada y los reintentos de React Query reciben siempre el mismo rechazo.
 */
function memoPromise<K, V>(cache: Map<K, Promise<V>>, key: K, make: () => Promise<V>): Promise<V> {
  let p = cache.get(key);
  if (!p) {
    p = make();
    cache.set(key, p);
    p.then(undefined, () => cache.delete(key));
  }
  return p;
}

const yearCache = new Map<number, Promise<YearData>>();

function loadYear(year: number): Promise<YearData> {
  return memoPromise(yearCache, year, async () => {
    const [meetings, sessions] = await Promise.all([
      of1<Of1Meeting[]>("meetings", { year }),
      of1<Of1Session[]>("sessions", { year }),
    ]);
    const sessionsByMeeting = new Map<number, Of1Session[]>();
    for (const s of sessions) {
      const list = sessionsByMeeting.get(s.meeting_key) ?? [];
      list.push(s);
      sessionsByMeeting.set(s.meeting_key, list);
    }
    // Solo meetings con carrera (excluye pretemporada/testing)
    const raceMeetings = meetings
      .filter((m) =>
        (sessionsByMeeting.get(m.meeting_key) ?? []).some((s) => s.session_name === "Race"),
      )
      .sort((a, b) => a.date_start.localeCompare(b.date_start));
    return { meetings: raceMeetings, sessionsByMeeting };
  });
}

async function resolveSession(year: number, gp: string, code: string): Promise<Of1Session> {
  const { meetings, sessionsByMeeting } = await loadYear(year);
  const meeting = meetings.find((m) => m.meeting_name === gp);
  if (!meeting) throw new Error(`No se encontró el GP "${gp}" en ${year} (OpenF1)`);
  const sessions = sessionsByMeeting.get(meeting.meeting_key) ?? [];
  const target = sessions.find((s) => SESSION_CODES[s.session_name] === code);
  if (!target) throw new Error(`No hay sesión ${code} en ${gp} ${year} (OpenF1)`);
  return target;
}

/* ------------------------------------------------------------------ */
/* Cachés por sesión                                                   */
/* ------------------------------------------------------------------ */

const driversCache = new Map<number, Promise<Of1Driver[]>>();
const lapsCache = new Map<number, Promise<Of1Lap[]>>();
const stintsCache = new Map<number, Promise<Of1Stint[]>>();

function getDrivers(sessionKey: number): Promise<Of1Driver[]> {
  return memoPromise(driversCache, sessionKey, () =>
    of1<Of1Driver[]>("drivers", { session_key: sessionKey }).then((rows) => {
      const seen = new Set<number>();
      return rows.filter((d) =>
        seen.has(d.driver_number) ? false : (seen.add(d.driver_number), true),
      );
    }),
  );
}

function getAllLaps(sessionKey: number): Promise<Of1Lap[]> {
  return memoPromise(lapsCache, sessionKey, () => of1<Of1Lap[]>("laps", { session_key: sessionKey }));
}

function getStints(sessionKey: number): Promise<Of1Stint[]> {
  return memoPromise(stintsCache, sessionKey, () => of1<Of1Stint[]>("stints", { session_key: sessionKey }));
}

async function acronymMaps(sessionKey: number) {
  const drivers = await getDrivers(sessionKey);
  const byNumber = new Map<number, Of1Driver>();
  const byAcronym = new Map<string, Of1Driver>();
  for (const d of drivers) {
    byNumber.set(d.driver_number, d);
    byAcronym.set(d.name_acronym, d);
  }
  return { drivers, byNumber, byAcronym };
}

/* ------------------------------------------------------------------ */
/* Tiempos de fin de vuelta (base de posiciones y gaps)                */
/* ------------------------------------------------------------------ */

/**
 * Para cada piloto, instante absoluto (ms) en que termina cada vuelta.
 * Fin de la vuelta N = date_start de la vuelta N+1 (robusto ante
 * lap_duration nulos, como la vuelta 1 con salida parada).
 */
function lapEndTimes(laps: Of1Lap[]): Map<number, Map<number, number>> {
  const byDriver = new Map<number, Of1Lap[]>();
  for (const l of laps) {
    const list = byDriver.get(l.driver_number) ?? [];
    list.push(l);
    byDriver.set(l.driver_number, list);
  }
  const out = new Map<number, Map<number, number>>();
  for (const [num, list] of byDriver) {
    list.sort((a, b) => a.lap_number - b.lap_number);
    const ends = new Map<number, number>();
    for (let i = 0; i < list.length; i++) {
      const next = list[i + 1];
      if (next?.date_start) {
        ends.set(list[i].lap_number, new Date(next.date_start).getTime());
      } else if (list[i].date_start && list[i].lap_duration != null) {
        ends.set(
          list[i].lap_number,
          new Date(list[i].date_start!).getTime() + list[i].lap_duration! * 1000,
        );
      }
    }
    out.set(num, ends);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Interpolación lineal (equivalente a np.interp)                      */
/* ------------------------------------------------------------------ */

function interp(grid: number[], x: number[], y: number[]): number[] {
  const out = new Array<number>(grid.length);
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
    const t = (g - x[j]) / (x[j + 1] - x[j]);
    out[i] = y[j] + t * (y[j + 1] - y[j]);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* API pública                                                         */
/* ------------------------------------------------------------------ */

export const openf1Api = {
  async latestRace(): Promise<LatestRace> {
    const now = Date.now();
    for (const year of [new Date().getFullYear(), new Date().getFullYear() - 1]) {
      try {
        const { meetings, sessionsByMeeting } = await loadYear(year);
        let last: { m: Of1Meeting; round: number; date: string } | null = null;
        for (let i = 0; i < meetings.length; i++) {
          const m = meetings[i];
          const race = (sessionsByMeeting.get(m.meeting_key) ?? []).find(
            (s) => s.session_name === "Race",
          );
          if (race && new Date(race.date_start).getTime() < now) {
            last = { m, round: i + 1, date: toUtcStr(race.date_start) };
          }
        }
        if (last) {
          return {
            year,
            gp: last.m.meeting_name,
            round: last.round,
            country: last.m.country_name,
            location: last.m.location,
            date: last.date,
          };
        }
      } catch {
        continue;
      }
    }
    throw new Error("No hay carreras disputadas (OpenF1)");
  },

  async events(year: number): Promise<EventInfo[]> {
    const { meetings, sessionsByMeeting } = await loadYear(year);
    return meetings.map((m, i) => {
      const sessions: SessionInfo[] = (sessionsByMeeting.get(m.meeting_key) ?? [])
        .sort((a, b) => a.date_start.localeCompare(b.date_start))
        .map((s) => ({
          name: s.session_name,
          code: SESSION_CODES[s.session_name] ?? s.session_name,
          date: toUtcStr(s.date_start),
          date_local: toLocalStr(s.date_start, s.gmt_offset || m.gmt_offset),
        }));
      const isSprint = sessions.some((s) => s.code === "Sprint");
      return {
        round: i + 1,
        name: m.meeting_name,
        official_name: m.meeting_official_name,
        country: m.country_name,
        location: m.location,
        date: toUtcStr(m.date_start),
        format: isSprint ? "sprint" : "conventional",
        sessions,
      };
    });
  },

  async drivers(year: number, gp: string, session: string): Promise<DriverInfo[]> {
    const ses = await resolveSession(year, gp, session);
    const drivers = await getDrivers(ses.session_key);
    // Solo pilotos con al menos una vuelta válida: sin ella no hay telemetría
    // que mostrar (p. ej. abandono en la vuelta de salida, DNS)
    const allLaps = await getAllLaps(ses.session_key);
    const withValidLap = new Set(
      allLaps.filter((l) => l.date_start && l.lap_duration != null).map((l) => l.driver_number),
    );
    return drivers.filter((d) => withValidLap.has(d.driver_number)).map((d) => ({
      number: String(d.driver_number),
      abbreviation: d.name_acronym,
      full_name: d.full_name,
      team: d.team_name ?? "",
      team_color: d.team_colour ? `#${d.team_colour}` : "#888888",
      headshot_url: d.headshot_url || null,
    }));
  },

  async laps(year: number, gp: string, session: string, drivers: string[]): Promise<LapData[]> {
    const ses = await resolveSession(year, gp, session);
    const [{ byAcronym }, allLaps, stints, pits] = await Promise.all([
      acronymMaps(ses.session_key),
      getAllLaps(ses.session_key),
      getStints(ses.session_key),
      of1<Of1Pit[]>("pit", { session_key: ses.session_key }),
    ]);

    const wanted = new Map<number, string>();
    for (const a of drivers) {
      const d = byAcronym.get(a);
      if (d) wanted.set(d.driver_number, a);
    }

    const pitLaps = new Set(pits.map((p) => `${p.driver_number}:${p.lap_number}`));
    const stintOf = (num: number, lap: number) =>
      stints.find((s) => s.driver_number === num && lap >= s.lap_start && lap <= s.lap_end);

    const bestSoFar = new Map<number, number>();
    const out: LapData[] = [];
    const sorted = allLaps
      .filter((l) => wanted.has(l.driver_number))
      .sort((a, b) => a.driver_number - b.driver_number || a.lap_number - b.lap_number);

    for (const l of sorted) {
      const stint = stintOf(l.driver_number, l.lap_number);
      let isPb = false;
      if (l.lap_duration != null) {
        const best = bestSoFar.get(l.driver_number);
        if (best === undefined || l.lap_duration < best) {
          bestSoFar.set(l.driver_number, l.lap_duration);
          isPb = true;
        }
      }
      out.push({
        driver: wanted.get(l.driver_number)!,
        lap_number: l.lap_number,
        lap_time: l.lap_duration,
        sector_1: l.duration_sector_1,
        sector_2: l.duration_sector_2,
        sector_3: l.duration_sector_3,
        compound: stint?.compound ?? null,
        tyre_life:
          stint != null
            ? (stint.tyre_age_at_start ?? 0) + (l.lap_number - stint.lap_start) + 1
            : null,
        stint: stint?.stint_number ?? null,
        is_personal_best: isPb,
        pit_in: pitLaps.has(`${l.driver_number}:${l.lap_number}`),
        pit_out: l.is_pit_out_lap,
        track_status: "1",
        position: null,
      });
    }
    return out;
  },

  async telemetry(
    year: number,
    gp: string,
    session: string,
    drivers: string[],
    lap: string,
  ): Promise<TelemetryData[]> {
    const ses = await resolveSession(year, gp, session);
    const [{ byAcronym }, allLaps, stints] = await Promise.all([
      acronymMaps(ses.session_key),
      getAllLaps(ses.session_key),
      getStints(ses.session_key),
    ]);

    // Índice de vueltas por piloto: evita recorrer todas las vueltas por cada piloto
    const lapsByNum = new Map<number, Of1Lap[]>();
    for (const l of allLaps) {
      const arr = lapsByNum.get(l.driver_number);
      if (arr) arr.push(l);
      else lapsByNum.set(l.driver_number, [l]);
    }

    const buildDriver = async (acronym: string): Promise<TelemetryData> => {
      const d = byAcronym.get(acronym);
      if (!d) throw new Error(`Piloto ${acronym} no encontrado (OpenF1)`);
      const mine = (lapsByNum.get(d.driver_number) ?? []).filter(
        (l) => l.date_start && l.lap_duration != null,
      );

      let chosen: Of1Lap | undefined;
      if (lap === "fastest") {
        chosen = mine.reduce<Of1Lap | undefined>(
          (best, l) => (!best || l.lap_duration! < best.lap_duration! ? l : best),
          undefined,
        );
        if (!chosen) throw new Error(`${acronym} no tiene vuelta rápida válida`);
      } else {
        chosen = mine.find((l) => l.lap_number === Number(lap));
        if (!chosen) throw new Error(`${acronym} no tiene vuelta ${lap}`);
      }

      const t0 = new Date(chosen.date_start!).getTime();
      const t1 = t0 + chosen.lap_duration! * 1000;
      // La clave "date>" serializa como `date%3E=valor` → la API lo lee `date>=valor`
      const dateParams = {
        session_key: ses.session_key,
        driver_number: d.driver_number,
        "date>": new Date(t0).toISOString().replace("Z", ""),
        "date<": new Date(t1).toISOString().replace("Z", ""),
      };

      const car = await of1<Of1CarData[]>("car_data", dateParams);
      if (car.length < 2) throw new Error(`Sin telemetría para ${acronym} (OpenF1)`);
      car.sort((a, b) => a.date.localeCompare(b.date));

      // Distancia integrada por trapecios a partir de la velocidad
      const times = car.map((c) => (new Date(c.date).getTime() - t0) / 1000);
      const dist = new Array<number>(car.length).fill(0);
      for (let i = 1; i < car.length; i++) {
        const dt = times[i] - times[i - 1];
        dist[i] = dist[i - 1] + (((car[i].speed + car[i - 1].speed) / 2) * dt) / 3.6;
      }

      const maxDist = dist[dist.length - 1];
      const grid: number[] = [];
      for (let g = 0; g < maxDist; g += STEP_METERS) grid.push(g);

      const speed = interp(grid, dist, car.map((c) => c.speed));
      const rpm = interp(grid, dist, car.map((c) => c.rpm));
      const throttle = interp(grid, dist, car.map((c) => Math.min(c.throttle, 100)));
      // OpenF1 da freno 0-100; el chart espera 0/1 como FastF1
      const brake = interp(grid, dist, car.map((c) => (c.brake > 50 ? 1 : 0)));
      const gear = interp(grid, dist, car.map((c) => c.n_gear));
      const drs = interp(
        grid,
        dist,
        car.map((c) => (c.drs != null && [10, 12, 14].includes(c.drs) ? 1 : 0)),
      );
      const timeChan = interp(grid, dist, times);

      // Posición en pista (puede no existir en sesiones muy recientes)
      let track: { x: number[]; y: number[] } | null = null;
      try {
        const loc = await of1<Of1Location[]>("location", dateParams);
        if (loc.length >= 2) {
          loc.sort((a, b) => a.date.localeCompare(b.date));
          const locTimes = loc.map((p) => (new Date(p.date).getTime() - t0) / 1000);
          const locDist = interp(locTimes, times, dist);
          track = {
            x: interp(grid, locDist, loc.map((p) => p.x)).map((v) => Math.round(v * 10) / 10),
            y: interp(grid, locDist, loc.map((p) => p.y)).map((v) => Math.round(v * 10) / 10),
          };
        }
      } catch {
        track = null;
      }

      const stint = stints.find(
        (s) =>
          s.driver_number === d.driver_number &&
          chosen!.lap_number >= s.lap_start &&
          chosen!.lap_number <= s.lap_end,
      );

      return {
        driver: acronym,
        lap_number: chosen.lap_number,
        lap_time: chosen.lap_duration,
        compound: stint?.compound ?? null,
        sectors: {
          s1: chosen.duration_sector_1 ?? null,
          s2: chosen.duration_sector_2 ?? null,
          s3: chosen.duration_sector_3 ?? null,
        },
        channels: {
          distance: grid.map((g) => Math.round(g * 10) / 10),
          speed: speed.map((v) => Math.round(v * 10) / 10),
          rpm: rpm.map((v) => Math.round(v)),
          throttle: throttle.map((v) => Math.round(v * 10) / 10),
          brake: brake.map((v) => Math.round(v)),
          gear: gear.map((v) => Math.round(v)),
          drs: drs.map((v) => Math.round(v)),
          time: timeChan.map((v) => Math.round(v * 1000) / 1000),
        },
        track,
      };
    };

    // Cada piloto en paralelo; uno que falle no tumba a los demás
    const settled = await Promise.all(
      drivers.map((a) =>
        buildDriver(a).then(
          (value) => ({ ok: true as const, value }),
          (error: unknown) => ({ ok: false as const, error: error as Error }),
        ),
      ),
    );
    const out = settled.flatMap((r) => (r.ok ? [r.value] : []));
    if (out.length === 0) {
      const firstErr = settled.find((r) => !r.ok) as { error: Error } | undefined;
      throw new Error(firstErr?.error.message ?? "Sin telemetría disponible para los pilotos seleccionados");
    }
    return out;
  },

  async positions(year: number, gp: string): Promise<RacePositions[]> {
    const ses = await resolveSession(year, gp, "R");
    const [{ byNumber }, allLaps] = await Promise.all([
      acronymMaps(ses.session_key),
      getAllLaps(ses.session_key),
    ]);
    const ends = lapEndTimes(allLaps);
    const maxLap = Math.max(0, ...allLaps.map((l) => l.lap_number));

    const out: RacePositions[] = [];
    for (let lapN = 1; lapN <= maxLap; lapN++) {
      const finishers: { num: number; t: number }[] = [];
      for (const [num, lapEnds] of ends) {
        const t = lapEnds.get(lapN);
        if (t != null) finishers.push({ num, t });
      }
      if (!finishers.length) continue;
      finishers.sort((a, b) => a.t - b.t);
      const positions: Record<string, number> = {};
      finishers.forEach((f, i) => {
        const acr = byNumber.get(f.num)?.name_acronym;
        if (acr) positions[acr] = i + 1;
      });
      out.push({ lap: lapN, positions });
    }
    return out;
  },

  async gaps(year: number, gp: string): Promise<RaceGaps[]> {
    const ses = await resolveSession(year, gp, "R");
    const [{ byNumber }, allLaps] = await Promise.all([
      acronymMaps(ses.session_key),
      getAllLaps(ses.session_key),
    ]);
    const ends = lapEndTimes(allLaps);
    const maxLap = Math.max(0, ...allLaps.map((l) => l.lap_number));

    const out: RaceGaps[] = [];
    for (let lapN = 1; lapN <= maxLap; lapN++) {
      const times: { num: number; t: number }[] = [];
      for (const [num, lapEnds] of ends) {
        const t = lapEnds.get(lapN);
        if (t != null) times.push({ num, t });
      }
      if (!times.length) continue;
      const leader = Math.min(...times.map((x) => x.t));
      const gaps: Record<string, number> = {};
      for (const { num, t } of times) {
        const acr = byNumber.get(num)?.name_acronym;
        if (acr) gaps[acr] = Math.round((t - leader) / 1000 * 1000) / 1000;
      }
      out.push({ lap: lapN, gaps });
    }
    return out;
  },

  async raceEvents(year: number, gp: string): Promise<TrackEvent[]> {
    const ses = await resolveSession(year, gp, "R");
    const rc = await of1<Of1RaceControl[]>("race_control", { session_key: ses.session_key });
    rc.sort((a, b) => a.date.localeCompare(b.date));

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
  },

  async results(year: number, gp: string): Promise<RaceResult[]> {
    const ses = await resolveSession(year, gp, "R");
    const [{ byNumber }, rows, grid] = await Promise.all([
      acronymMaps(ses.session_key),
      of1<Of1SessionResult[]>("session_result", { session_key: ses.session_key }),
      of1<Of1Grid[]>("starting_grid", { session_key: ses.session_key }),
    ]);
    const gridOf = new Map(grid.map((g) => [g.driver_number, g.position]));

    return rows.map((r) => {
      const d = byNumber.get(r.driver_number);
      return {
        position: r.position ?? null,
        driver: d?.name_acronym ?? String(r.driver_number),
        headshot_url: d?.headshot_url || null,
        full_name: d?.full_name ?? "",
        team: d?.team_name ?? "",
        team_color: d?.team_colour ? `#${d.team_colour}` : null,
        points: typeof r.points === "number" ? r.points : 0,
        status: r.dsq ? "Disqualified" : r.dns ? "Did not start" : r.dnf ? "Retired" : "Finished",
        grid_position: gridOf.get(r.driver_number) ?? null,
      };
    });
  },

  async strategy(year: number, gp: string): Promise<Stint[]> {
    const ses = await resolveSession(year, gp, "R");
    const [{ byNumber }, stints, allLaps] = await Promise.all([
      acronymMaps(ses.session_key),
      getStints(ses.session_key),
      getAllLaps(ses.session_key),
    ]);

    const out: Stint[] = [];
    for (const s of stints) {
      const acr = byNumber.get(s.driver_number)?.name_acronym;
      if (!acr) continue;
      const stintLaps = allLaps.filter(
        (l) =>
          l.driver_number === s.driver_number &&
          l.lap_number >= s.lap_start &&
          l.lap_number <= s.lap_end &&
          l.lap_duration != null,
      );
      const avg = stintLaps.length
        ? stintLaps.reduce((acc, l) => acc + l.lap_duration!, 0) / stintLaps.length
        : null;
      const age = s.tyre_age_at_start ?? 0;
      out.push({
        driver: acr,
        stint_number: s.stint_number,
        compound: s.compound ?? "UNKNOWN",
        lap_start: s.lap_start,
        lap_end: s.lap_end,
        tyre_life_start: age + 1,
        tyre_life_end: age + (s.lap_end - s.lap_start) + 1,
        avg_lap_time: avg != null ? Math.round(avg * 1000) / 1000 : null,
      });
    }
    out.sort((a, b) => a.driver.localeCompare(b.driver) || a.stint_number - b.stint_number);
    return out;
  },

  async circuit(): Promise<CircuitInfo> {
    // OpenF1 no expone corners; el mapa se dibuja desde la telemetría igualmente
    return { corners: [], rotation: 0 };
  },

  async sessionResults(year: number, gp: string, session: string): Promise<SessionResults> {
    const ses = await resolveSession(year, gp, session);
    const { byNumber } = await acronymMaps(ses.session_key);
    const code = session.toUpperCase();

    const base = (num: number) => {
      const d = byNumber.get(num);
      return {
        driver: d?.name_acronym ?? String(num),
        full_name: d?.full_name ?? "",
        team: d?.team_name ?? "",
        team_color: d?.team_colour ? `#${d.team_colour}` : "#888888",
        headshot_url: d?.headshot_url || null,
      };
    };

    if (code === "R" || code === "SPRINT") {
      const [rows, grid] = await Promise.all([
        of1<Of1SessionResult[]>("session_result", { session_key: ses.session_key }),
        of1<Of1Grid[]>("starting_grid", { session_key: ses.session_key }),
      ]);
      const gridOf = new Map(grid.map((g) => [g.driver_number, g.position]));
      const out: SessionResultRow[] = rows.map((r) => {
        let time: string | null = null;
        if (r.position === 1 && typeof r.duration === "number") {
          const h = Math.floor(r.duration / 3600);
          const m = Math.floor((r.duration % 3600) / 60);
          const s = r.duration % 60;
          const ss = s.toFixed(3).padStart(6, "0");
          time = h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
        } else if (typeof r.gap_to_leader === "number") {
          time = `+${r.gap_to_leader.toFixed(3)}`;
        } else if (typeof r.gap_to_leader === "string") {
          time = r.gap_to_leader;
        }
        return {
          ...base(r.driver_number),
          position: r.position ?? null,
          grid: gridOf.get(r.driver_number) ?? null,
          points: typeof r.points === "number" ? r.points : 0,
          status: r.dsq
            ? "Disqualified"
            : r.dns
              ? "Did not start"
              : r.dnf
                ? "Retired"
                : "Finished",
          time,
        };
      });
      return { kind: "race", rows: out };
    }

    if (code === "Q" || code === "SQ") {
      const rows = await of1<Of1SessionResult[]>("session_result", {
        session_key: ses.session_key,
      });
      const out: SessionResultRow[] = rows.map((r) => {
        const qs = Array.isArray(r.duration) ? r.duration : [];
        return {
          ...base(r.driver_number),
          position: r.position ?? null,
          q1: qs[0] ?? null,
          q2: qs[1] ?? null,
          q3: qs[2] ?? null,
        };
      });
      return { kind: "quali", rows: out };
    }

    // Libres: mejor vuelta de cada piloto a partir de los laps
    const allLaps = await getAllLaps(ses.session_key);
    const byDriver = new Map<number, Of1Lap[]>();
    for (const l of allLaps) {
      const list = byDriver.get(l.driver_number) ?? [];
      list.push(l);
      byDriver.set(l.driver_number, list);
    }
    const bests: { num: number; best: number; laps: number }[] = [];
    for (const [num, list] of byDriver) {
      const valid = list.filter((l) => l.lap_duration != null);
      if (!valid.length) continue;
      bests.push({
        num,
        best: Math.min(...valid.map((l) => l.lap_duration!)),
        laps: list.length,
      });
    }
    bests.sort((a, b) => a.best - b.best);
    const fastest = bests[0]?.best ?? 0;
    const out: SessionResultRow[] = bests.map((b, i) => ({
      ...base(b.num),
      position: i + 1,
      best_lap: Math.round(b.best * 1000) / 1000,
      gap: i ? Math.round((b.best - fastest) * 1000) / 1000 : null,
      laps: b.laps,
    }));
    return { kind: "practice", rows: out };
  },

  /* Standings: Jolpica (sucesor de Ergast) directamente desde el navegador */

  async driverStandings(year: number): Promise<DriverStanding[]> {
    const res = await fetch(`${JOLPICA}/${year}/driverstandings.json`);
    if (!res.ok) throw new Error(`Jolpica ${res.status}`);
    const data = await res.json();
    const lists = data?.MRData?.StandingsTable?.StandingsLists;
    if (!lists?.length) return [];
    interface JolpicaDriverStanding {
      position: string;
      points: string;
      wins: string;
      Driver: {
        driverId: string;
        code?: string;
        givenName: string;
        familyName: string;
        nationality: string;
      };
      Constructors: { name: string; constructorId: string }[];
    }
    return (lists[0].DriverStandings as JolpicaDriverStanding[]).map((s) => ({
      position: Number(s.position),
      points: Number(s.points),
      wins: Number(s.wins),
      driver_id: s.Driver.driverId,
      code: s.Driver.code ?? s.Driver.driverId.slice(0, 3).toUpperCase(),
      given_name: s.Driver.givenName,
      family_name: s.Driver.familyName,
      nationality: s.Driver.nationality,
      team: s.Constructors[0]?.name ?? "",
      team_id: s.Constructors[0]?.constructorId ?? "",
    }));
  },

  async constructorStandings(year: number): Promise<ConstructorStanding[]> {
    const res = await fetch(`${JOLPICA}/${year}/constructorstandings.json`);
    if (!res.ok) throw new Error(`Jolpica ${res.status}`);
    const data = await res.json();
    const lists = data?.MRData?.StandingsTable?.StandingsLists;
    if (!lists?.length) return [];
    interface JolpicaConstructorStanding {
      position: string;
      points: string;
      wins: string;
      Constructor: { constructorId: string; name: string; nationality: string };
    }
    return (lists[0].ConstructorStandings as JolpicaConstructorStanding[]).map((s) => ({
      position: Number(s.position),
      points: Number(s.points),
      wins: Number(s.wins),
      constructor_id: s.Constructor.constructorId,
      name: s.Constructor.name,
      nationality: s.Constructor.nationality,
    }));
  },
};
