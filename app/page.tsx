"use client";

import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { ChartSkeleton } from "@/components/ChartPanel";
import { DriverSelector } from "@/components/DriverSelector";
import { ViewErrorBoundary } from "@/components/ErrorBoundary";
import { Header } from "@/components/Header";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { SessionLoadingLanding } from "@/components/SessionLoadingLanding";
import { SessionSelector } from "@/components/SessionSelector";
import { SplashScreen } from "@/components/SplashScreen";
import { StartLights } from "@/components/StartLights";
import { MobileTabBar, TabNav } from "@/components/TabNav";
import { useUrlSync } from "@/hooks/useUrlSync";
import { useSessionStore, type ViewTab } from "@/store/sessionStore";

// Cada vista en su propio chunk: recharts y el código de las demás vistas no
// entran en la carga inicial; se descargan al abrir la pestaña.
const loading = () => (
  <div className="space-y-5">
    <ChartSkeleton height={360} />
    <ChartSkeleton height={240} />
  </div>
);
const VIEWS: Record<ViewTab, React.ComponentType> = {
  telemetry: dynamic(
    () => import("@/components/telemetry/TelemetryView").then((m) => m.TelemetryView),
    { loading },
  ),
  laps: dynamic(() => import("@/components/laps/LapsView").then((m) => m.LapsView), { loading }),
  race: dynamic(() => import("@/components/race/RaceView").then((m) => m.RaceView), { loading }),
  strategy: dynamic(
    () => import("@/components/strategy/StrategyView").then((m) => m.StrategyView),
    { loading },
  ),
  calendar: dynamic(
    () => import("@/components/calendar/CalendarView").then((m) => m.CalendarView),
    { loading },
  ),
};

export default function Home() {
  const { session, tab } = useSessionStore(useShallow((s) => ({ session: s.session, tab: s.tab })));
  const [booted, setBooted] = useState(false);
  useUrlSync(booted);

  const View = VIEWS[tab];
  // El calendario no necesita sesión; el resto de vistas sí
  const showView = tab === "calendar" || !!session;

  return (
    <div className="flex min-h-dvh flex-col">
      <AnimatePresence>
        {!booted && <SplashScreen onReady={() => setBooted(true)} />}
      </AnimatePresence>
      {booted && (
        <>
          <SessionLoadingLanding />
          <LoadingOverlay />
        </>
      )}
      <Header />

      <main className="mx-auto w-full max-w-[1500px] flex-1 space-y-5 px-3 pb-28 pt-5 md:space-y-6 md:px-6 md:pb-10">
        {/* El calendario es una página propia: sin selector de sesión ni pestañas */}
        {tab !== "calendar" && (
          <>
            <section
              aria-label="Selección de sesión"
              className="panel no-cut animate-rise flex flex-col gap-5 p-4 md:p-5"
            >
              <SessionSelector />
              <DriverSelector />
            </section>
            <TabNav />
          </>
        )}

        {showView ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 16, scale: 0.995 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{
                type: "spring",
                stiffness: 420,
                damping: 40,
                opacity: { duration: 0.2 },
              }}
            >
              <ViewErrorBoundary key={tab}>
                <View />
              </ViewErrorBoundary>
            </motion.div>
          </AnimatePresence>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="panel relative flex flex-col items-center justify-center gap-4 overflow-hidden px-6 py-20 text-center md:py-24"
          >
            <StartLights />
            <h2 className="font-wide text-xl uppercase md:text-2xl">
              Elige una sesión para empezar
            </h2>
            <p className="max-w-md text-sm text-ink-3">
              Selecciona temporada, Gran Premio y sesión. La primera carga descarga los datos
              oficiales de la sesión y puede tardar unos segundos.
            </p>
          </motion.div>
        )}
      </main>

      <footer className="hidden px-6 py-4 text-center text-[11px] text-ink-3 md:block">
        Datos: OpenF1 · Jolpica · MultiViewer · Uso no comercial · DeltaZero
      </footer>
      <MobileTabBar />
    </div>
  );
}
