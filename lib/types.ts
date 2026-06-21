export interface SessionInfo {
  name: string;
  code: string;
  date: string | null; // UTC
  date_local: string | null; // hora local del circuito, con offset
}

export interface EventInfo {
  round: number;
  name: string;
  official_name: string;
  country: string;
  location: string;
  date: string | null;
  format: string;
  sessions: SessionInfo[];
}

export interface DriverInfo {
  number: string;
  abbreviation: string;
  full_name: string;
  team: string;
  team_color: string;
  headshot_url: string | null;
}

export interface LapData {
  driver: string;
  lap_number: number;
  lap_time: number | null;
  sector_1: number | null;
  sector_2: number | null;
  sector_3: number | null;
  compound: string | null;
  tyre_life: number | null;
  stint: number | null;
  is_personal_best: boolean;
  pit_in: boolean;
  pit_out: boolean;
  track_status: string;
  position: number | null;
}

export interface TelemetryData {
  driver: string;
  lap_number: number;
  lap_time: number | null;
  compound: string | null;
  // tiempos de sector de la vuelta representada (s); null si OpenF1 no los publica
  sectors: { s1: number | null; s2: number | null; s3: number | null } | null;
  channels: {
    distance: number[];
    speed: number[];
    rpm: number[];
    throttle: number[];
    brake: number[];
    gear: number[];
    drs: number[];
    time: number[];
  };
  // null en sesiones sin datos de posición (p. ej. carreras muy recientes)
  track: { x: number[]; y: number[] } | null;
}

export interface RacePositions {
  lap: number;
  positions: Record<string, number>;
}

export interface RaceGaps {
  lap: number;
  gaps: Record<string, number>;
}

export interface TrackEvent {
  lap: number;
  events: string[];
}

export interface RaceResult {
  position: number | null;
  driver: string;
  headshot_url: string | null;
  full_name: string;
  team: string;
  team_color: string | null;
  points: number;
  status: string;
  grid_position: number | null;
}

export interface Corner {
  number: number;
  letter: string;
  x: number;
  y: number;
  distance: number | null;
  angle: number;
}

export interface CircuitInfo {
  corners: Corner[];
  rotation: number;
}

export interface SessionResultRow {
  position: number | null;
  driver: string;
  full_name: string;
  team: string;
  team_color: string;
  headshot_url: string | null;
  // carrera
  grid?: number | null;
  points?: number;
  status?: string;
  time?: string | null;
  // clasificación
  q1?: number | null;
  q2?: number | null;
  q3?: number | null;
  // libres
  best_lap?: number;
  gap?: number | null;
  laps?: number;
}

export interface SessionResults {
  kind: "race" | "quali" | "practice";
  rows: SessionResultRow[];
}

export interface DriverStanding {
  position: number;
  points: number;
  wins: number;
  driver_id: string;
  code: string;
  given_name: string;
  family_name: string;
  nationality: string;
  team: string;
  team_id: string;
}

export interface ConstructorStanding {
  position: number;
  points: number;
  wins: number;
  constructor_id: string;
  name: string;
  nationality: string;
}

export interface Stint {
  driver: string;
  stint_number: number;
  compound: string;
  lap_start: number;
  lap_end: number;
  tyre_life_start: number;
  tyre_life_end: number;
  avg_lap_time: number | null;
}

export interface LatestRace {
  year: number;
  gp: string;
  round: number;
  country: string;
  location: string;
  date: string;
}
