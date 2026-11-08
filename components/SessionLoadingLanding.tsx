"use client";

import { AnimatePresence } from "framer-motion";
import { useShallow } from "zustand/react/shallow";

import { LoadingLanding } from "@/components/LoadingLanding";
import { useDrivers, useEvents } from "@/hooks/useF1Data";
import { useSessionStore } from "@/store/sessionStore";

/**
 * Landing de carga cuando se cambia a una sesión que aún no está descargada
 * (la query de pilotos dispara la carga de datos de OpenF1). Con datos en
 * caché no llega a aparecer.
 */
export function SessionLoadingLanding() {
  const { year, gp, session } = useSessionStore(
    useShallow((s) => ({ year: s.year, gp: s.gp, session: s.session })),
  );
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
