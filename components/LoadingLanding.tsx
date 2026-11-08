"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import { LogoMark } from "@/components/LogoMark";
import { MiniTrack } from "@/components/calendar/MiniTrack";
import { Button } from "@/components/ui/Button";

const STATUS_MESSAGES = [
  "Conectando con los datos oficiales…",
  "Descargando la clasificación…",
  "Descargando vueltas y tiempos…",
  "Procesando telemetría…",
  "Calentando neumáticos…",
  "Montando el muro de boxes…",
];

export interface LandingRace {
  gp: string;
  year: number;
  round?: number;
  location?: string;
}

/**
 * Landing de carga a pantalla completa: logo, silueta del circuito y barra
 * de progreso 0→100 sobre un fondo de fibra de carbono y rejilla de telemetría.
 */
export function LoadingLanding({
  race,
  done = false,
  error = null,
  onSkip,
}: {
  race: LandingRace | null;
  done?: boolean;
  error?: string | null;
  onSkip?: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const [statusIdx, setStatusIdx] = useState(0);

  // Progreso asintótico hacia 92% mientras carga; al terminar salta a 100
  useEffect(() => {
    if (error || done) return;
    const id = setInterval(() => {
      setProgress((p) => Math.min(92, p + (92 - p) * 0.018 + 0.05));
    }, 100);
    return () => clearInterval(id);
  }, [done, error]);

  const shown = done ? 100 : progress;

  useEffect(() => {
    if (done || error) return;
    const id = setInterval(() => {
      setStatusIdx((i) => (i + 1) % STATUS_MESSAGES.length);
    }, 3500);
    return () => clearInterval(id);
  }, [done, error]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04, filter: "blur(8px)" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-100 flex flex-col items-center justify-center overflow-hidden bg-carbon"
    >
      {/* Fondo: rejilla de telemetría + halo rojo de marca */}
      <div className="pointer-events-none absolute inset-0 telemetry-grid" />
      <div
        className="pointer-events-none absolute left-1/2 top-[38%] h-[60vw] w-[60vw] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(225,6,0,0.12), transparent 62%)" }}
      />
      {/* Barrido de luz vertical, evoca el paso de un coche */}
      <motion.div
        className="pointer-events-none absolute inset-y-0 w-40"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)",
        }}
        animate={{ left: ["-15%", "115%"] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative mb-9 flex items-center gap-3 md:gap-4"
      >
        <LogoMark size={52} />
        <h1 className="font-wide text-4xl uppercase leading-none tracking-wider md:text-5xl">
          Delta<span className="text-f1red">Zero</span>
        </h1>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: race ? 1 : 0, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="mb-8 flex h-36 items-center justify-center"
      >
        {race && (
          <div className="flex flex-col items-center gap-3">
            {race.location && (
              <MiniTrack location={race.location} size={128} className="opacity-90" />
            )}
            <p className="glass rounded-full px-4 py-1.5 text-sm text-ink-2">
              <span className="font-bold uppercase tracking-wider text-ink">{race.gp}</span>
              <span className="ml-2 text-ink-3">
                {race.round ? `· Ronda ${race.round} ` : ""}· {race.year}
              </span>
            </p>
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="glass flex w-105 max-w-[88vw] flex-col items-center rounded-[28px] px-6 py-5"
      >
        <div className="mb-3 flex w-full items-end justify-between">
          <AnimatePresence mode="wait">
            <motion.p
              key={error ? "error" : done ? "done" : statusIdx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className={`text-xs ${error ? "text-red-300" : done ? "font-bold uppercase tracking-[0.3em] text-f1red-bright" : "text-ink-3"}`}
            >
              {error
                ? "No se pudieron cargar los datos"
                : done
                  ? "Luces fuera"
                  : STATUS_MESSAGES[statusIdx]}
            </motion.p>
          </AnimatePresence>
          <span className="font-mono text-2xl font-black tabular-nums leading-none">
            {Math.floor(shown)}
            <span className="text-sm text-ink-3">%</span>
          </span>
        </div>

        <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-f1red/70 to-f1red-bright shadow-[0_0_16px_rgb(225_6_0/0.7)]"
            animate={{ width: `${shown}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
          <motion.div
            className="absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-white/30 to-transparent"
            animate={{ left: ["-10%", "110%"] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        {error && onSkip && (
          <Button variant="primary" className="mt-5 uppercase" onClick={onSkip}>
            Entrar igualmente
          </Button>
        )}
      </motion.div>
    </motion.div>
  );
}
