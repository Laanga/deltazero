"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { IconButton } from "@/components/ui/Button";

const subscribeNoop = () => () => {};

/**
 * Hoja modal: en móvil sube desde abajo con asa (bottom sheet); en escritorio
 * es un panel centrado. Portal a <body>, Escape cierra, bloquea el scroll y
 * devuelve el foco al cerrar.
 */
export function Sheet({
  open,
  onClose,
  title,
  eyebrow,
  children,
  maxWidth = "max-w-3xl",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  // El portal necesita document: solo en cliente (sin setState en efecto)
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => panelRef.current?.focus());
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-90 flex items-end justify-center bg-black/55 backdrop-blur-sm md:items-center md:p-6"
          onClick={onClose}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            initial={{ y: "100%", opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className={`glass flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[32px] outline-none md:max-h-[85vh] md:rounded-[32px] ${maxWidth}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-white/25 md:hidden" />
            <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-4 md:pt-6">
              <div className="min-w-0">
                {eyebrow && <p className="eyebrow !text-f1red-bright">{eyebrow}</p>}
                <h2 className="font-wide mt-1 truncate text-xl uppercase leading-tight md:text-2xl">
                  {title}
                </h2>
              </div>
              <IconButton aria-label="Cerrar" size="sm" onClick={onClose}>
                <X size={16} />
              </IconButton>
            </div>
            <div className="overflow-y-auto overscroll-contain px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
