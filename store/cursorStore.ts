import { create } from "zustand";

/**
 * Punto inspeccionado de la vuelta (índice sobre la rejilla de distancia del
 * piloto de referencia). Vive fuera del store de sesión y fuera del estado de
 * TelemetryView: cambia hasta 60 veces por segundo durante la reproducción y
 * solo deben re-renderizar los componentes que lo pintan (cursor de las
 * gráficas, mapa, lecturas), nunca las gráficas completas.
 */
interface CursorState {
  idx: number | null;
  playing: boolean;
  speed: number;
  setIdx: (idx: number | null) => void;
  /** Interacción manual (hover, arrastre): pausa la reproducción. */
  scrub: (idx: number | null) => void;
  setPlaying: (playing: boolean | ((p: boolean) => boolean)) => void;
  setSpeed: (speed: number) => void;
  reset: () => void;
}

export const useCursorStore = create<CursorState>((set) => ({
  idx: null,
  playing: false,
  speed: 1,
  setIdx: (idx) => set({ idx }),
  scrub: (idx) => set({ idx, playing: false }),
  setPlaying: (playing) =>
    set((s) => ({ playing: typeof playing === "function" ? playing(s.playing) : playing })),
  setSpeed: (speed) => set({ speed }),
  reset: () => set({ idx: null, playing: false }),
}));
