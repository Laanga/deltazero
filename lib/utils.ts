export function formatLapTime(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}

export function formatDelta(seconds: number): string {
  const sign = seconds >= 0 ? "+" : "−";
  return `${sign}${Math.abs(seconds).toFixed(3)}`;
}

export const COMPOUND_COLORS: Record<string, string> = {
  SOFT: "#ff3333",
  MEDIUM: "#ffd12e",
  HARD: "#ebebeb",
  INTERMEDIATE: "#43b02a",
  WET: "#0067ad",
  UNKNOWN: "#888888",
};

export function compoundColor(compound: string | null | undefined): string {
  return COMPOUND_COLORS[compound ?? "UNKNOWN"] ?? "#888888";
}

/** Si dos pilotos del mismo equipo se comparan, el segundo recibe línea discontinua. */
export function lineDashFor(index: number, drivers: { team_color: string }[]): string | undefined {
  const mine = drivers[index];
  if (!mine) return undefined;
  const firstWithColor = drivers.findIndex((d) => d.team_color === mine.team_color);
  return firstWithColor !== index ? "6 4" : undefined;
}
