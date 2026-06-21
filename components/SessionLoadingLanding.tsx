"use client";

import { AnimatePresence } from "framer-motion";

import { LoadingLanding } from "@/components/LoadingLanding";
import { useDrivers, useEvents } from "@/hooks/useF1Data";
import { useSessionStore } from "@/store/sessionStore";

/**
 * Muestra el landing de carga cuando se cambia a una sesión que aún no está
 * descargada (la query de pilotos dispara la carga de datos de OpenF1).
 * Con datos en cache no llega a aparecer.
 */
export function SessionLoadingLanding() {
  const { year, gp, session } = useSessionStore();
  const { isLoading } = useDrivers();
  const { data: events } = useEvents();

  const show = !!gp && !!session && isLoading;
  const event = events?.find((e) => e.name === gp);

  return (
    <AnimatePresence>
      {show && (
        <LoadingLanding
          key={`${year}-${gp}-${session}`}
          race={{ gp: gp!, year, round: event?.round, location: event?.location }}
        />
      )}
    </AnimatePresence>
  );
}
