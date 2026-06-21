"use client";

import type { QueryClient } from "@tanstack/react-query";

const KEY = "dz-cache-v1";
const MAX_AGE = 12 * 60 * 60 * 1000; // 12 h

// Solo cachés pequeñas y estables. NUNCA telemetría/laps/positions (arrays enormes
// que reventarían la cuota de localStorage).
const PERSIST = new Set(["events", "driverStandings", "constructorStandings", "latestRace"]);

interface Entry {
  key: unknown[];
  data: unknown;
}
interface Stored {
  t: number;
  entries: Entry[];
}

const persistable = (key: unknown): key is unknown[] =>
  Array.isArray(key) && PERSIST.has(String(key[0]));

/** Vuelca a la caché en memoria lo guardado en localStorage (si no ha caducado). */
export function hydrateQueries(client: QueryClient) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed?.entries || Date.now() - parsed.t > MAX_AGE) return;
    for (const e of parsed.entries) {
      if (persistable(e.key)) client.setQueryData(e.key, e.data);
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
          entries.push({ key: q.queryKey as unknown[], data: q.state.data });
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
