"use client";

import { useIsFetching } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * Pantalla de carga global: aparece con blur cuando hay datos cargando.
 * Espera 350ms antes de mostrarse para no parpadear en cargas instantáneas (cache).
 * pointer-events-none: es visual, no bloquea la interacción.
 */
export function LoadingOverlay() {
  // Excluye la carga de sesión (drivers): esa la cubre el landing a pantalla completa
  const fetching = useIsFetching({ predicate: (q) => q.queryKey[0] !== "drivers" }) > 0;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!fetching) {
      setVisible(false);
      return;
    }
    const t = setTimeout(() => setVisible(true), 350);
    return () => clearTimeout(t);
  }, [fetching]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-carbon/55 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.9, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: -8 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center gap-5 rounded-md border border-edge bg-panel/90 px-12 py-9 shadow-2xl shadow-black/60"
          >
            {/* Doble anillo girando en sentidos opuestos */}
            <div className="relative h-16 w-16">
              <motion.span
                className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-f1red border-r-f1red/40"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
              />
              <motion.span
                className="absolute inset-2 rounded-full border-[3px] border-transparent border-b-zinc-400 border-l-zinc-400/30"
                animate={{ rotate: -360 }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
              />
              <span className="absolute inset-0 m-auto h-2.5 w-2.5 animate-pulse rounded-full bg-f1red" />
            </div>

            <div className="text-center">
              <p className="flex items-center gap-1 text-sm font-black uppercase tracking-[0.3em]">
                Cargando datos
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    animate={{ opacity: [0.2, 1, 0.2] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  >
                    .
                  </motion.span>
                ))}
              </p>
              <p className="mt-1.5 text-xs text-zinc-500">
                La primera carga de una sesión descarga los datos oficiales y puede tardar
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
