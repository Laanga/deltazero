"use client";

import { AnimatePresence, motion } from "framer-motion";

import { useState } from "react";

import { DriverSelector } from "@/components/DriverSelector";
import { Header } from "@/components/Header";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { SessionLoadingLanding } from "@/components/SessionLoadingLanding";
import { SplashScreen } from "@/components/SplashScreen";
import { SessionSelector } from "@/components/SessionSelector";
import { StartLights } from "@/components/StartLights";
import { TabNav } from "@/components/TabNav";
import { CalendarView } from "@/components/calendar/CalendarView";
import { LapsView } from "@/components/laps/LapsView";
import { RaceView } from "@/components/race/RaceView";
import { StrategyView } from "@/components/strategy/StrategyView";
import { TelemetryView } from "@/components/telemetry/TelemetryView";
import { useSessionStore } from "@/store/sessionStore";

const VIEWS = {
  telemetry: TelemetryView,
  laps: LapsView,
  race: RaceView,
  strategy: StrategyView,
  calendar: CalendarView,
} as const;

export default function Home() {
  const { session, tab } = useSessionStore();
  const [booted, setBooted] = useState(false);
  const View = VIEWS[tab];
  // El calendario no necesita sesión; el resto de vistas sí
  const showView = tab === "calendar" || !!session;

  return (
    <div className="flex min-h-screen flex-col">
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

      <main className="mx-auto w-full max-w-[1500px] flex-1 space-y-6 px-6 py-6">
        {/* El calendario es una página propia: sin selector de sesión ni pestañas */}
        {tab !== "calendar" && (
          <>
            <div className="panel no-cut flex flex-col gap-5 p-5">
              <SessionSelector />
              <DriverSelector />
            </div>
            <TabNav />
          </>
        )}

        {showView ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 24, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -16, filter: "blur(4px)" }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <View />
            </motion.div>
          </AnimatePresence>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="panel relative flex flex-col items-center justify-center gap-4 overflow-hidden py-24"
          >
            <StartLights />
            <h2 className="text-2xl font-black uppercase italic tracking-wider">
              Elige una sesión para empezar
            </h2>
            <p className="max-w-md text-center text-sm text-zinc-500">
              Selecciona temporada, Gran Premio y sesión. La primera carga descarga los datos
              oficiales de la sesión y puede tardar unos segundos.
            </p>
          </motion.div>
        )}
      </main>

      <footer className="border-t border-edge px-6 py-3 text-center text-[11px] text-zinc-600">
        Datos: OpenF1 · Jolpica · Uso no comercial · DeltaZero
      </footer>
    </div>
  );
}
