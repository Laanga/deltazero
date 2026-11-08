"use client";

import { AnimatePresence, motion } from "framer-motion";
import { forwardRef, useCallback, useLayoutEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const MOBILE_QUERY = "(max-width: 767px)";
const GAP = 8;
const EDGE = 8;

function subscribeMobile(cb: () => void) {
  const mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const getMobile = () => window.matchMedia(MOBILE_QUERY).matches;
const noopSubscribe = () => () => {};

interface Placement {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
  origin: "top" | "bottom";
}

/**
 * Capa flotante anclada a un elemento, renderizada en un portal sobre <body>.
 *
 * Al vivir fuera del árbol de la página no puede quedar tapada por otras
 * tarjetas, la cabecera fija o la barra de pestañas (cada una crea su propio
 * contexto de apilamiento). Se coloca debajo del ancla o, si no cabe, encima;
 * se reajusta con scroll y resize. En móvil se muestra como bottom sheet.
 */
export const Popover = forwardRef<
  HTMLDivElement,
  {
    open: boolean;
    onClose: () => void;
    anchor: HTMLElement | null;
    /** Alinear con el borde izquierdo o derecho del ancla. */
    align?: "start" | "end";
    minWidth?: number;
    maxHeight?: number;
    /** Título que se muestra solo en el bottom sheet de móvil. */
    sheetTitle?: string;
    children: React.ReactNode;
  } & Omit<React.HTMLAttributes<HTMLDivElement>, "children">
>(function Popover(
  {
    open,
    onClose,
    anchor,
    align = "start",
    minWidth = 0,
    maxHeight = 340,
    sheetTitle,
    children,
    className = "",
    ...rest
  },
  ref,
) {
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const mobile = useSyncExternalStore(subscribeMobile, getMobile, () => false);
  const [place, setPlace] = useState<Placement | null>(null);

  const measure = useCallback(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(vw - EDGE * 2, Math.max(r.width, minWidth));
    let left = align === "end" ? r.right - width : r.left;
    left = Math.max(EDGE, Math.min(left, vw - width - EDGE));

    const below = vh - r.bottom - GAP - EDGE;
    const above = r.top - GAP - EDGE;
    // Abajo salvo que no quepa y arriba haya claramente más sitio
    const down = below >= Math.min(maxHeight, 220) || below >= above;
    setPlace(
      down
        ? { left, width, top: r.bottom + GAP, maxHeight: Math.min(maxHeight, below), origin: "top" }
        : {
            left,
            width,
            bottom: vh - r.top + GAP,
            maxHeight: Math.min(maxHeight, above),
            origin: "bottom",
          },
    );
  }, [anchor, align, minWidth, maxHeight]);

  useLayoutEffect(() => {
    if (!open || mobile) return;
    const id = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      setPlace(null);
    };
  }, [open, mobile, measure]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (mobile || place) && (
        <div className="fixed inset-0 z-[100]" key="popover-layer">
          {/* Fondo: cierra al pulsar fuera; en móvil oscurece como un sheet */}
          <motion.div
            className={`absolute inset-0 ${mobile ? "bg-black/55 backdrop-blur-[2px]" : ""}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={ref}
            {...(rest as object)}
            initial={
              mobile
                ? { y: "100%" }
                : { opacity: 0, scale: 0.96, y: place?.origin === "top" ? -6 : 6 }
            }
            animate={mobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
            exit={mobile ? { y: "100%" } : { opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 520, damping: 40 }}
            style={
              mobile
                ? undefined
                : {
                    left: place!.left,
                    width: place!.width,
                    top: place!.top,
                    bottom: place!.bottom,
                    maxHeight: place!.maxHeight,
                    transformOrigin: place!.origin,
                  }
            }
            className={`menu-surface absolute overflow-y-auto overscroll-contain p-1.5 outline-none ${
              mobile
                ? "inset-x-2 bottom-2 max-h-[70dvh] rounded-[28px] pb-[max(0.375rem,env(safe-area-inset-bottom))]"
                : "rounded-[22px]"
            } ${className}`}
          >
            {mobile && (
              <div className="sticky -top-1.5 z-10 -mx-1.5 -mt-1.5 mb-1 rounded-t-[28px] bg-[rgb(26_26_35)] px-1.5 pb-1 pt-2">
                <div className="mx-auto h-1.5 w-10 rounded-full bg-white/25" />
                {sheetTitle && <p className="eyebrow px-3 pt-2">{sheetTitle}</p>}
              </div>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
});
