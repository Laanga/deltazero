"use client";

import { useEffect } from "react";

import { lowerBound } from "@/lib/f1math";
import { useCursorStore } from "@/store/cursorStore";

/** Petición de salto durante la reproducción (s). La consume el bucle. */
export const seekRequest = { t: null as number | null };

/**
 * Reproductor de vuelta: avanza un reloj y lo traduce a índice de distancia
 * en el store del cursor (~30 fps). Solo re-renderiza lo suscrito al cursor.
 */
export function usePlayback(timeChannel: number[] | undefined) {
  const playing = useCursorStore((s) => s.playing);
  const speed = useCursorStore((s) => s.speed);

  useEffect(() => {
    if (!playing || !timeChannel?.length) return;
    const { setIdx, setPlaying } = useCursorStore.getState();
    const lapEnd = timeChannel[timeChannel.length - 1];
    let raf = 0;
    let last = performance.now();
    let lastSet = 0;
    // Arranca desde el marcador actual (o desde el inicio si está al final)
    const startIdx = useCursorStore.getState().idx;
    let t = startIdx != null ? timeChannel[Math.min(startIdx, timeChannel.length - 1)] : 0;
    if (t >= lapEnd - 0.1) t = 0;

    const step = (now: number) => {
      if (seekRequest.t != null) {
        t = seekRequest.t;
        seekRequest.t = null;
      }
      t += ((now - last) / 1000) * speed;
      last = now;
      if (t >= lapEnd) {
        setIdx(timeChannel.length - 1);
        setPlaying(false);
        return;
      }
      if (now - lastSet > 33) {
        lastSet = now;
        setIdx(lowerBound(timeChannel, t));
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, timeChannel]);
}
