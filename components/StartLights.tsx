"use client";

import { motion } from "framer-motion";

/**
 * Semáforo de salida de F1: las cinco luces se encienden en secuencia,
 * quedan fijas un instante y se apagan todas a la vez ("lights out").
 */
export function StartLights() {
  return (
    <div className="flex gap-2.5" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => {
        const on = 0.1 + i * 0.1; // encendido escalonado
        return (
          <div
            key={i}
            className="flex h-10 w-7 flex-col items-center justify-center gap-1.5 rounded-sm border border-edge bg-black/60"
          >
            {[0, 1].map((j) => (
              <motion.span
                key={j}
                className="h-2.5 w-2.5 rounded-full bg-f1red"
                style={{ boxShadow: "0 0 10px rgba(225, 6, 0, 0.9)" }}
                animate={{ opacity: [0.12, 0.12, 1, 1, 0.12, 0.12] }}
                transition={{
                  duration: 5,
                  times: [0, on, on + 0.02, 0.72, 0.73, 1],
                  repeat: Infinity,
                  ease: "linear",
                }}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
