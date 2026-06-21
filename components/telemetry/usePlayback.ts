"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Reproductor de vuelta: avanza un marcador de tiempo y traduce a índice de
 * distancia (~20 fps) sincronizando charts y mapa. Devuelve los controles.
 */
export function usePlayback({
  timeChannel,
  lapEnd,
  hoverIdx,
  setHoverIdx,
}: {
  timeChannel: number[] | undefined;
  lapEnd: number;
  hoverIdx: number | null;
  setHoverIdx: (idx: number | null) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);
  const hoverIdxRef = useRef<number | null>(null);
  useEffect(() => {
    hoverIdxRef.current = hoverIdx;
  }, [hoverIdx]);
  const seekRef = useRef<number | null>(null);

  useEffect(() => {
    if (!playing || !timeChannel?.length) return;
    let raf = 0;
    let last = performance.now();
    let lastSet = 0;
    // Arranca desde el marcador actual (o desde el inicio si está al final)
    const startIdx = hoverIdxRef.current;
    let t = startIdx != null ? timeChannel[Math.min(startIdx, timeChannel.length - 1)] : 0;
    if (t >= lapEnd - 0.1) t = 0;

    const step = (now: number) => {
      if (seekRef.current != null) {
        t = seekRef.current;
        seekRef.current = null;
      }
      t += ((now - last) / 1000) * playSpeed;
      last = now;
      if (t >= lapEnd) {
        setHoverIdx(timeChannel.length - 1);
        setPlaying(false);
        return;
      }
      // Limita las actualizaciones de estado a ~20fps para no saturar los charts
      if (now - lastSet > 50) {
        lastSet = now;
        let lo = 0, hi = timeChannel.length - 1;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (timeChannel[mid] < t) lo = mid + 1;
          else hi = mid;
        }
        setHoverIdx(lo);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, playSpeed, timeChannel, lapEnd, setHoverIdx]);

  return { playing, setPlaying, playSpeed, setPlaySpeed, seekRef };
}
