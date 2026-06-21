"use client";

import shapes from "@/lib/circuitShapes.json";

// Localizaciones de FastF1 que no coinciden literalmente con el dataset de trazados
const ALIASES: Record<string, string> = {
  "miami gardens": "miami",
  "monte carlo": "monaco",
  "marina bay": "singapore",
  "spa francorchamps": "spa francorchamps",
  "yas island": "yas marina",
  "portimao": "portimao",
};

function normalize(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .trim();
}

export function findShape(location: string): number[][] | null {
  const key = normalize(location);
  const resolved = ALIASES[key] ?? key;
  return (shapes as Record<string, number[][]>)[resolved] ?? null;
}

export function MiniTrack({
  location,
  size = 84,
  className = "",
}: {
  location: string;
  size?: number;
  className?: string;
}) {
  const shape = findShape(location);
  if (!shape) return null;

  const path = shape
    .map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`)
    .join(" ") + " Z";

  return (
    <svg
      viewBox="-6 -6 112 112"
      width={size}
      height={size}
      className={`pointer-events-none ${className}`}
      aria-hidden
    >
      <path d={path} fill="none" stroke="#52525e" strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" />
      <path d={path} fill="none" stroke="#101016" strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
