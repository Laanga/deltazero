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
import {
  formatRaceDuration,
  groupBy,
  integrateDistance,
  interp,
  parseRaceControl,
  raceProgress,
  round1,
  round3,
  toLocalStr,
  toUtcStr,
} from "./f1math";

const OF1 = "https://api.openf1.org/v1";
const JOLPICA = "https://api.jolpi.ca/ergast/f1";
const MULTIVIEWER = "https://api.multiviewer.app/api/v1";

// Paso de resampleo de telemetría: un punto cada 5 m
const STEP_METERS = 5;

/* ------------------------------------------------------------------ */
/* Limitador de peticiones                                             */
/* ------------------------------------------------------------------ */
// OpenF1 limita el ritmo (~3 req/s). Antes las peticiones iban en fila india
// con 250 ms de espera entre cada una; ahora salen hasta MAX_CONCURRENT en
// paralelo respetando un intervalo mínimo entre arranques, y un 429 pausa la
// cola entera (no solo la petición que lo recibió).

const MAX_CONCURRENT = 3;
const MIN_INTERVAL_MS = 340;

let active = 0;
let lastStart = 0;
let pausedUntil = 0;
const waiters: (() => void)[] = [];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function acquire(): Promise<void> {
  for (;;) {
    const now = Date.now();
    const wait = Math.max(lastStart + MIN_INTERVAL_MS, pausedUntil) - now;
    if (active < MAX_CONCURRENT && wait <= 0) {
      active++;
      lastStart = now;
      return;
    }
    if (active >= MAX_CONCURRENT) await new Promise<void>((r) => waiters.push(r));
    else await sleep(wait);
  }
}

function release() {
  active--;
  waiters.shift()?.();
}

async function rawFetch(url: string): Promise<unknown> {
  for (let attempt = 0; attempt < 5; attempt++) {
    await acquire();
    let res: Response;
    try {
      res = await fetch(url);
    } finally {
      release();
    }
    if (res.status === 429) {
      // Backoff con tope + jitter; pausa global para no seguir golpeando la API
      const backoff = Math.min(1000 * 2 ** attempt, 8000) + Math.floor(Math.random() * 400);
      pausedUntil = Math.max(pausedUntil, Date.now() + backoff);
      await sleep(backoff);
      continue;
    }
    // OpenF1 responde 404 {"detail": "No results found."} para conjuntos vacíos
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`OpenF1 ${res.status} en ${url}`);
    return res.json();
  }
  throw new Error(`OpenF1: rate limit persistente en ${url}`);
}

const inflight = new Map<string, Promise<unknown>>();

/** GET limitado + dedupe de peticiones idénticas en vuelo. */
function of1<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.append(k, String(v));
  const url = `${OF1}/${path}${qs.size ? `?${qs}` : ""}`;

  const existing = inflight.get(url);
  if (existing) return existing as Promise<T>;

  const p = rawFetch(url).then((data) =>
    // OpenF1 devuelve {"detail": "..."} cuando no hay datos
    data && !Array.isArray(data) ? [] : data,
  ) as Promise<T>;

  inflight.set(url, p);
  // then(fn, fn) en rama aparte: .finally() sobre p crearía una promesa
  // derivada cuyo rechazo nadie maneja (unhandled rejection en cada fallo)
  p.then(
    () => inflight.delete(url),
    () => inflight.delete(url),
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
  circuit_key?: number;
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
    const sessionsByMeeting = groupBy(sessions, (s) => s.meeting_key);
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
  return memoPromise(lapsCache, sessionKey, () =>
    of1<Of1Lap[]>("laps", { session_key: sessionKey }),
  );
}

function getStints(sessionKey: number): Promise<Of1Stint[]> {
  return memoPromise(stintsCache, sessionKey, () =>
    of1<Of1Stint[]>("stints", { session_key: sessionKey }),
  );
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

/** Stints indexados por piloto: evita recorrer todos los stints por cada vuelta. */
function stintFinder(stints: Of1Stint[]) {
  const byDriver = groupBy(stints, (s) => s.driver_number);
  return (num: number, lap: number) =>
    byDriver.get(num)?.find((s) => lap >= s.lap_start && lap <= s.lap_end);
}

/** Posiciones y gaps de carrera calculados una vez por sesión (los usan dos vistas). */
const progressCache = new Map<number, Promise<ReturnType<typeof raceProgress>>>();

function getRaceProgress(sessionKey: number) {
  return memoPromise(progressCache, sessionKey, async () => {
    const [{ byNumber }, allLaps] = await Promise.all([
      acronymMaps(sessionKey),
      getAllLaps(sessionKey),
    ]);
    return raceProgress(allLaps, (num) => byNumber.get(num)?.name_acronym);
  });
}

function resultStatus(r: Of1SessionResult): string {
  return r.dsq ? "Disqualified" : r.dns ? "Did not start" : r.dnf ? "Retired" : "Finished";
}

interface MvPoint {
  number: number;
  letter?: string;
  angle: number;
  trackPosition: { x: number; y: number };
}
interface MvCircuit {
  rotation: number;
  x: number[];
  y: number[];
  corners?: MvPoint[];
  marshalSectors?: MvPoint[];
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
    return drivers
      .filter((d) => withValidLap.has(d.driver_number))
      .map((d) => ({
        number: String(d.driver_number),
        abbreviation: d.name_acronym,
        full_name: d.full_name,
        team: d.team_name ?? "",
        team_color: d.team_colour ? `#${d.team_colour}` : "#888888",
        headshot_url: d.headshot_url || null,
      }));
  },

  /** Todas las vueltas de la sesión (todos los pilotos): las vistas filtran en cliente. */
  async laps(year: number, gp: string, session: string): Promise<LapData[]> {
    const ses = await resolveSession(year, gp, session);
    const [{ byNumber }, allLaps, stints, pits] = await Promise.all([
      acronymMaps(ses.session_key),
      getAllLaps(ses.session_key),
      getStints(ses.session_key),
      of1<Of1Pit[]>("pit", { session_key: ses.session_key }),
    ]);

    const pitLaps = new Set(pits.map((p) => `${p.driver_number}:${p.lap_number}`));
    const stintOf = stintFinder(stints);

    const bestSoFar = new Map<number, number>();
    const out: LapData[] = [];
    const sorted = [...allLaps].sort(
      (a, b) => a.driver_number - b.driver_number || a.lap_number - b.lap_number,
    );

    for (const l of sorted) {
      const acr = byNumber.get(l.driver_number)?.name_acronym;
      if (!acr) continue;
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
        driver: acr,
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

  /**
   * Telemetría de UNA vuelta de UN piloto, resampleada cada STEP_METERS.
   * Una query por piloto: añadir un piloto a la comparación solo descarga el suyo.
   */
  async telemetry(
    year: number,
    gp: string,
    session: string,
    acronym: string,
    lap: string,
  ): Promise<TelemetryData> {
    const ses = await resolveSession(year, gp, session);
    const [{ byAcronym }, allLaps, stints] = await Promise.all([
      acronymMaps(ses.session_key),
      getAllLaps(ses.session_key),
      getStints(ses.session_key),
    ]);

    const d = byAcronym.get(acronym);
    if (!d) throw new Error(`Piloto ${acronym} no encontrado (OpenF1)`);
    const mine = allLaps.filter(
      (l) => l.driver_number === d.driver_number && l.date_start && l.lap_duration != null,
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

    const t0 = Date.parse(chosen.date_start!);
    const t1 = t0 + chosen.lap_duration! * 1000;
    // La clave "date>" serializa como `date%3E=valor` → la API lo lee `date>=valor`
    const dateParams = {
      session_key: ses.session_key,
      driver_number: d.driver_number,
      "date>": new Date(t0).toISOString().replace("Z", ""),
      "date<": new Date(t1).toISOString().replace("Z", ""),
    };

    // car_data y location salen a la vez (el limitador decide el ritmo)
    const [car, loc] = await Promise.all([
      of1<Of1CarData[]>("car_data", dateParams),
      of1<Of1Location[]>("location", dateParams).catch(() => [] as Of1Location[]),
    ]);
    if (car.length < 2) throw new Error(`Sin telemetría para ${acronym} (OpenF1)`);
    car.sort((a, b) => a.date.localeCompare(b.date));

    const times = car.map((c) => (Date.parse(c.date) - t0) / 1000);
    const dist = integrateDistance(
      times,
      car.map((c) => c.speed),
    );

    const maxDist = dist[dist.length - 1];
    const grid: number[] = [];
    for (let g = 0; g < maxDist; g += STEP_METERS) grid.push(g);

    const speed = interp(
      grid,
      dist,
      car.map((c) => c.speed),
    );
    const rpm = interp(
      grid,
      dist,
      car.map((c) => c.rpm),
    );
    const throttle = interp(
      grid,
      dist,
      car.map((c) => Math.min(c.throttle, 100)),
    );
    // OpenF1 da freno 0-100; el chart espera 0/1 como FastF1
    const brake = interp(
      grid,
      dist,
      car.map((c) => (c.brake > 50 ? 1 : 0)),
    );
    const gear = interp(
      grid,
      dist,
      car.map((c) => c.n_gear),
    );
    const drs = interp(
      grid,
      dist,
      car.map((c) => (c.drs != null && [10, 12, 14].includes(c.drs) ? 1 : 0)),
    );
    const timeChan = interp(grid, dist, times);

    // Posición en pista (puede no existir en sesiones muy recientes)
    let track: { x: number[]; y: number[] } | null = null;
    if (loc.length >= 2) {
      loc.sort((a, b) => a.date.localeCompare(b.date));
      const locTimes = loc.map((p) => (Date.parse(p.date) - t0) / 1000);
      const locDist = interp(locTimes, times, dist);
      track = {
        x: interp(
          grid,
          locDist,
          loc.map((p) => p.x),
        ).map(round1),
        y: interp(
          grid,
          locDist,
          loc.map((p) => p.y),
        ).map(round1),
      };
    }

    const stint = stintFinder(stints)(d.driver_number, chosen.lap_number);

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
        distance: grid.map(round1),
        speed: speed.map(round1),
        rpm: rpm.map(Math.round),
        throttle: throttle.map(round1),
        brake: brake.map(Math.round),
        gear: gear.map(Math.round),
        drs: drs.map(Math.round),
        time: timeChan.map(round3),
      },
      track,
    };
  },

  async positions(year: number, gp: string): Promise<RacePositions[]> {
    const ses = await resolveSession(year, gp, "R");
    return (await getRaceProgress(ses.session_key)).positions;
  },

  async gaps(year: number, gp: string): Promise<RaceGaps[]> {
    const ses = await resolveSession(year, gp, "R");
    return (await getRaceProgress(ses.session_key)).gaps;
  },

  async raceEvents(year: number, gp: string): Promise<TrackEvent[]> {
    const ses = await resolveSession(year, gp, "R");
    const rc = await of1<Of1RaceControl[]>("race_control", { session_key: ses.session_key });
    return parseRaceControl(rc);
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
        status: resultStatus(r),
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

    // Vueltas válidas indexadas por piloto → la media de cada stint no recorre toda la carrera
    const lapsByDriver = groupBy(
      allLaps.filter((l) => l.lap_duration != null),
      (l) => l.driver_number,
    );

    const out: Stint[] = [];
    for (const s of stints) {
      const acr = byNumber.get(s.driver_number)?.name_acronym;
      if (!acr) continue;
      const stintLaps = (lapsByDriver.get(s.driver_number) ?? []).filter(
        (l) => l.lap_number >= s.lap_start && l.lap_number <= s.lap_end,
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
        avg_lap_time: avg != null ? round3(avg) : null,
      });
    }
    out.sort((a, b) => a.driver.localeCompare(b.driver) || a.stint_number - b.stint_number);
    return out;
  },

  /**
   * Trazado oficial (MultiViewer, mismo origen que la retransmisión): curvas
   * numeradas, rotación de TV, silueta completa y paneles de comisarios.
   * Mismas coordenadas que /location de OpenF1. Si no está disponible se
   * devuelve vacío y el mapa se dibuja igualmente desde la telemetría.
   */
  async circuit(year: number, gp: string): Promise<CircuitInfo> {
    const empty: CircuitInfo = { corners: [], rotation: 0, outline: null, marshalSectors: [] };
    const { meetings } = await loadYear(year);
    const meeting = meetings.find((m) => m.meeting_name === gp);
    if (!meeting?.circuit_key) return empty;

    // El año en curso puede no estar publicado aún: prueba también el anterior
    for (const y of [year, year - 1]) {
      try {
        const res = await fetch(`${MULTIVIEWER}/circuits/${meeting.circuit_key}/${y}`);
        if (!res.ok) continue;
        const data = (await res.json()) as MvCircuit;
        return {
          rotation: Number(data.rotation) || 0,
          outline: data.x?.length ? { x: data.x, y: data.y } : null,
          corners: (data.corners ?? []).map((c) => ({
            number: c.number,
            letter: c.letter ?? "",
            x: c.trackPosition.x,
            y: c.trackPosition.y,
            angle: c.angle,
            distance: null,
          })),
          marshalSectors: (data.marshalSectors ?? []).map((m) => ({
            number: m.number,
            x: m.trackPosition.x,
            y: m.trackPosition.y,
          })),
        };
      } catch {
        /* red / CORS: prueba el siguiente año o cae al vacío */
      }
    }
    return empty;
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
          time = formatRaceDuration(r.duration);
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
          status: resultStatus(r),
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
    const byDriver = groupBy(await getAllLaps(ses.session_key), (l) => l.driver_number);
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
      best_lap: round3(b.best),
      gap: i ? round3(b.best - fastest) : null,
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
