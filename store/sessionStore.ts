import { create } from "zustand";

export type ViewTab = "telemetry" | "laps" | "race" | "strategy" | "calendar";

interface SessionState {
  year: number;
  gp: string | null;
  session: string | null;
  selectedDrivers: string[];
  lap: string; // "fastest" o número de vuelta
  tab: ViewTab;
  setYear: (year: number) => void;
  setGp: (gp: string | null) => void;
  setSession: (session: string | null) => void;
  toggleDriver: (abbr: string) => void;
  clearDrivers: () => void;
  setLap: (lap: string) => void;
  setTab: (tab: ViewTab) => void;
}

const MAX_DRIVERS = 5;

export const useSessionStore = create<SessionState>((set) => ({
  // Temporada actual por defecto (OpenF1 tiene datos desde 2023)
  year: Math.max(2023, new Date().getFullYear()),
  gp: null,
  session: null,
  selectedDrivers: [],
  lap: "fastest",
  tab: "telemetry",
  setYear: (year) => set({ year, gp: null, session: null, selectedDrivers: [] }),
  setGp: (gp) => set({ gp, session: null, selectedDrivers: [] }),
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
}));
