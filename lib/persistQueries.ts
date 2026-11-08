"use client";

import type { QueryClient } from "@tanstack/react-query";

const KEY = "dz-cache-v2";
const MAX_AGE = 12 * 60 * 60 * 1000; // 12 h

// Solo cachés pequeñas y estables. NUNCA telemetría/laps/positions (arrays enormes
// que reventarían la cuota de localStorage). `drivers` y `circuit` son pocos KB y
// hacen que volver a la web arranque sin esperar a OpenF1.
const PERSIST = new Set([
  "events",
  "driverStandings",
  "constructorStandings",
  "latestRace",
  "drivers",
  "circuit",
]);

interface Entry {
  key: unknown[];
  data: unknown;
  /** Momento real de descarga (dataUpdatedAt de React Query). */
  at?: number;
}
interface Stored {
  t: number;
  entries: Entry[];
}

const persistable = (key: unknown): key is unknown[] =>
  Array.isArray(key) && PERSIST.has(String(key[0]));

const hydrated = new WeakSet<QueryClient>();

/**
 * Vuelca a la caché en memoria lo guardado en localStorage (si no ha caducado).
 * Idempotente: lo llaman tanto Providers como el splash (los efectos de los
 * hijos corren antes que los del padre, y el splash necesita la caché ya).
 */
export function hydrateQueries(client: QueryClient) {
  if (typeof window === "undefined" || hydrated.has(client)) return;
  hydrated.add(client);
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed?.entries) return;
    for (const e of parsed.entries) {
      if (Date.now() - (e.at ?? parsed.t) > MAX_AGE) continue;
      // updatedAt real: así staleTime se cuenta desde que se descargó, no desde que se leyó
      if (persistable(e.key)) client.setQueryData(e.key, e.data, { updatedAt: e.at ?? parsed.t });
    }
  } catch {
    /* caché corrupta: ignorar */
  }
}

/** Persiste (con debounce) las queries de la lista blanca; devuelve la función de limpieza. */
export function attachQueryPersistence(client: QueryClient): () => void {
  if (typeof window === "undefined") return () => {};
  let timer: ReturnType<typeof setTimeout> | null = null;

  const save = () => {
    timer = null;
    try {
      const entries: Entry[] = [];
      for (const q of client.getQueryCache().getAll()) {
        if (q.state.status === "success" && persistable(q.queryKey) && q.state.data !== undefined) {
          entries.push({
            key: q.queryKey as unknown[],
            data: q.state.data,
            at: q.state.dataUpdatedAt,
          });
        }
      }
      localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), entries }));
    } catch {
      /* cuota u otros errores: ignorar */
    }
  };

  const unsub = client.getQueryCache().subscribe(() => {
    if (timer == null) timer = setTimeout(save, 1000);
  });

  return () => {
    if (timer != null) clearTimeout(timer);
    unsub();
  };
}
