"use client";

import { useEffect } from "react";

import { paramsToSelection, selectionToParams, useSessionStore } from "@/store/sessionStore";

/** Selección inicial codificada en la URL (null si no hay o es inválida). */
export function readUrlSelection() {
  if (typeof window === "undefined") return null;
  const sel = paramsToSelection(new URLSearchParams(window.location.search));
  return sel?.gp ? sel : null;
}

/**
 * Mantiene la URL sincronizada con la selección para poder compartir enlaces y
 * usar atrás/adelante. Cambios de GP/sesión/pestaña crean entrada de historial;
 * pilotos y vuelta solo la reemplazan (no llenar el historial de clics).
 */
export function useUrlSync(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const write = (push: boolean) => {
      const qs = selectionToParams(useSessionStore.getState()).toString();
      if (qs === window.location.search.slice(1)) return;
      const url = `${window.location.pathname}?${qs}`;
      if (push) window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    };
    write(false);

    const unsub = useSessionStore.subscribe((s, prev) => {
      const nav =
        s.year !== prev.year ||
        s.gp !== prev.gp ||
        s.session !== prev.session ||
        s.tab !== prev.tab;
      const minor = s.selectedDrivers !== prev.selectedDrivers || s.lap !== prev.lap;
      if (nav || minor) write(nav);
    });

    const onPop = () => {
      const sel = paramsToSelection(new URLSearchParams(window.location.search));
      if (sel) useSessionStore.getState().applySelection(sel);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      unsub();
      window.removeEventListener("popstate", onPop);
    };
  }, [enabled]);
}
