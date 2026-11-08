"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { LoadingLanding, type LandingRace } from "@/components/LoadingLanding";
import { readUrlSelection } from "@/hooks/useUrlSync";
import { api } from "@/lib/api";
import { hydrateQueries } from "@/lib/persistQueries";
import { useSessionStore } from "@/store/sessionStore";

const STATIC = { staleTime: Infinity } as const;

/**
 * Arranque: decide la sesión inicial (la del enlace compartido si hay una en
 * la URL; si no, la última carrera disputada), precarga sus pilotos y entra.
 * Usa la caché de React Query (persistida en localStorage), así que volver a
 * la web es prácticamente instantáneo.
 */
export function SplashScreen({ onReady }: { onReady: () => void }) {
  const [race, setRace] = useState<LandingRace | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finished = useRef(false);
  const qc = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    hydrateQueries(qc);
    (async () => {
      try {
        const fromUrl = readUrlSelection();
        let target: { year: number; gp: string; session: string };
        if (fromUrl?.gp && fromUrl.year) {
          target = { year: fromUrl.year, gp: fromUrl.gp, session: fromUrl.session ?? "R" };
          useSessionStore.getState().applySelection({ ...fromUrl, session: target.session });
          setRace({ gp: target.gp, year: target.year });
        } else {
          const latest = await qc.fetchQuery({
            queryKey: ["latestRace"],
            queryFn: () => api.latestRace(),
            staleTime: 30 * 60_000,
          });
          if (cancelled) return;
          target = { year: latest.year, gp: latest.gp, session: "R" };
          setRace({
            gp: latest.gp,
            year: latest.year,
            round: latest.round,
            location: latest.location,
          });
          useSessionStore.getState().applySelection({
            year: latest.year,
            gp: latest.gp,
            session: "R",
            selectedDrivers: [],
            lap: "fastest",
            tab: "race",
          });
        }

        // Precarga los pilotos: la app entra con la sesión lista
        await qc.fetchQuery({
          queryKey: ["drivers", target.year, target.gp, target.session],
          queryFn: () => api.drivers(target.year, target.gp, target.session),
          ...STATIC,
        });
        if (cancelled || finished.current) return;
        finished.current = true;
        setDone(true);
        setTimeout(onReady, 650);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <LoadingLanding race={race} done={done} error={error} onSkip={onReady} />;
}
