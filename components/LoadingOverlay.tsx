"use client";

import { useIsFetching } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * Indicador global de carga en forma de pastilla flotante (tipo Dynamic
 * Island): no tapa la pantalla ni bloquea la interacción. Espera 350 ms antes
 * de aparecer para no parpadear en cargas instantáneas (caché).
 */
export function LoadingOverlay() {
  // Excluye la carga de sesión (drivers): esa la cubre el landing a pantalla completa
  const count = useIsFetching({ predicate: (q) => q.queryKey[0] !== "drivers" });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(count > 0), count > 0 ? 350 : 0);
    return () => clearTimeout(t);
  }, [count]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -16, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.92 }}
          transition={{ type: "spring", stiffness: 480, damping: 34 }}
          className="pointer-events-none fixed left-1/2 top-[5.25rem] z-50 -translate-x-1/2 md:top-24"
        >
          <div className="glass flex items-center gap-3 rounded-full py-2 pl-2.5 pr-4">
            <span className="relative flex h-6 w-6 items-center justify-center">
              <motion.span
                className="absolute inset-0 rounded-full border-2 border-transparent border-t-f1red-bright border-r-f1red/40"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
              />
              <span className="h-1.5 w-1.5 rounded-full bg-f1red-bright" />
            </span>
            <span className="text-xs font-bold uppercase tracking-[0.16em]">Cargando datos</span>
            {count > 1 && <span className="font-mono text-[11px] text-ink-3">×{count}</span>}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
