import { create } from "zustand";

export type MapMode = "sectors" | "speed" | "dominance" | "duel";

export interface Duel {
  ref: string;
  rival: string;
}

/** Estado compartido del mapa y del comparador (el comparador puede cambiar la capa del mapa). */
interface MapState {
  mode: MapMode;
  follow: string | null;
  duel: Duel | null;
  setMode: (mode: MapMode) => void;
  setFollow: (follow: string | null | ((f: string | null) => string | null)) => void;
  setDuel: (duel: Duel | null) => void;
}

export const useMapStore = create<MapState>((set) => ({
  mode: "sectors",
  follow: null,
  duel: null,
  setMode: (mode) => set({ mode }),
  setFollow: (follow) =>
    set((s) => ({ follow: typeof follow === "function" ? follow(s.follow) : follow })),
  setDuel: (duel) => set({ duel }),
}));
