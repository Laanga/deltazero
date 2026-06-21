"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { LoadingLanding, type LandingRace } from "@/components/LoadingLanding";
import { api } from "@/lib/api";
import { useSessionStore } from "@/store/sessionStore";

/** Splash de arranque: precarga la última carrera disputada y entra con ella seleccionada. */
export function SplashScreen({ onReady }: { onReady: () => void }) {
  const [race, setRace] = useState<LandingRace | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const doneRef = useRef(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const latest = await api.latestRace();
        if (cancelled) return;
        setRace(latest);
        // Precarga los pilotos de la sesión para entrar con datos listos
        const drivers = await api.drivers(latest.year, latest.gp, "R");
        if (cancelled || doneRef.current) return;
        doneRef.current = true;

        // Siembra el cache de React Query para que la app no vuelva a pedirlo
        queryClient.setQueryData(["drivers", latest.year, latest.gp, "R"], drivers);

        const store = useSessionStore.getState();
        store.setYear(latest.year);
        store.setGp(latest.gp);
        store.setSession("R");
        store.setTab("race");

        setDone(true);
        setTimeout(onReady, 900);
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
