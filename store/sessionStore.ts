import { create } from "zustand";

export type ViewTab = "telemetry" | "laps" | "race" | "strategy" | "calendar";

export const VIEW_TABS: ViewTab[] = ["telemetry", "laps", "race", "strategy", "calendar"];
export const MAX_DRIVERS = 5;
export const FIRST_OPENF1_SEASON = 2023;

interface SessionSelection {
  year: number;
  gp: string | null;
  session: string | null;
  selectedDrivers: string[];
  lap: string; // "fastest" o número de vuelta
  tab: ViewTab;
}

interface SessionState extends SessionSelection {
  setYear: (year: number) => void;
  setGp: (gp: string | null) => void;
  setSession: (session: string | null) => void;
  toggleDriver: (abbr: string) => void;
  clearDrivers: () => void;
  setLap: (lap: string) => void;
  setTab: (tab: ViewTab) => void;
  /** Aplica de golpe una selección completa (arranque desde la URL, splash, botón atrás). */
  applySelection: (sel: Partial<SessionSelection>) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  // Temporada actual por defecto (OpenF1 tiene datos desde 2023)
  year: Math.max(FIRST_OPENF1_SEASON, new Date().getFullYear()),
  gp: null,
  session: null,
  selectedDrivers: [],
  lap: "fastest",
  tab: "telemetry",
  setYear: (year) => set({ year, gp: null, session: null, selectedDrivers: [], lap: "fastest" }),
  setGp: (gp) => set({ gp, session: null, selectedDrivers: [], lap: "fastest" }),
  setSession: (session) => set({ session, selectedDrivers: [], lap: "fastest" }),
  toggleDriver: (abbr) =>
    set((state) => {
      if (state.selectedDrivers.includes(abbr)) {
        return { selectedDrivers: state.selectedDrivers.filter((d) => d !== abbr) };
      }
      if (state.selectedDrivers.length >= MAX_DRIVERS) return state;
      return { selectedDrivers: [...state.selectedDrivers, abbr] };
    }),
  clearDrivers: () => set({ selectedDrivers: [] }),
  setLap: (lap) => set({ lap }),
  setTab: (tab) => set({ tab }),
  applySelection: (sel) => set(sel),
}));

/* ------------------------------------------------------------------ */
/* Serialización a la URL: ?y=2025&gp=Monaco+Grand+Prix&s=R&d=VER,NOR  */
/* ------------------------------------------------------------------ */

export function selectionToParams(s: SessionSelection): URLSearchParams {
  const p = new URLSearchParams();
  p.set("y", String(s.year));
  if (s.gp) p.set("gp", s.gp);
  if (s.session) p.set("s", s.session);
  if (s.selectedDrivers.length) p.set("d", s.selectedDrivers.join(","));
  if (s.lap !== "fastest") p.set("lap", s.lap);
  if (s.tab !== "telemetry") p.set("tab", s.tab);
  return p;
}

export function paramsToSelection(p: URLSearchParams): Partial<SessionSelection> | null {
  const year = Number(p.get("y"));
  if (!Number.isInteger(year) || year < FIRST_OPENF1_SEASON || year > new Date().getFullYear()) {
    return null;
  }
  const tab = p.get("tab") as ViewTab | null;
  const lap = p.get("lap");
  return {
    year,
    gp: p.get("gp"),
    session: p.get("gp") ? p.get("s") : null,
    selectedDrivers: (p.get("d") ?? "")
      .split(",")
      .map((d) => d.trim().toUpperCase())
      .filter((d) => /^[A-Z]{3}$/.test(d))
      .slice(0, MAX_DRIVERS),
    lap: lap && /^\d+$/.test(lap) ? lap : "fastest",
    tab: tab && VIEW_TABS.includes(tab) ? tab : "telemetry",
  };
}
