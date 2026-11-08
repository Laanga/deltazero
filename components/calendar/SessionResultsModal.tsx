"use client";

import { useQuery } from "@tanstack/react-query";

import { DriverAvatar } from "@/components/DriverAvatar";
import { DriverTag } from "@/components/DriverTag";
import { Sheet } from "@/components/ui/Sheet";
import { api } from "@/lib/api";
import type { SessionResultRow } from "@/lib/types";
import { formatLapTime } from "@/lib/utils";

export interface ResultsTarget {
  year: number;
  gp: string;
  session: string; // código FP1/Q/R...
  sessionName: string;
}

const KIND_COLUMNS: Record<string, string[]> = {
  race: ["Parrilla", "Tiempo", "Puntos"],
  quali: ["Q1", "Q2", "Q3"],
  practice: ["Mejor vuelta", "Gap", "Vueltas"],
};

function fmtQ(v: number | null | undefined): string {
  return v != null ? formatLapTime(v) : "—";
}

function RowCells({ kind, row }: { kind: string; row: SessionResultRow }) {
  if (kind === "race") {
    return (
      <>
        <td className="px-3 py-2 text-right font-mono text-ink-3">{row.grid ?? "—"}</td>
        <td className="px-3 py-2 text-right font-mono">{row.time ?? row.status ?? "—"}</td>
        <td className="px-3 py-2 text-right font-mono font-bold text-ink">
          {row.points ? `+${row.points}` : ""}
        </td>
      </>
    );
  }
  if (kind === "quali") {
    const bestKey = row.q3 != null ? "q3" : row.q2 != null ? "q2" : "q1";
    return (
      <>
        {(["q1", "q2", "q3"] as const).map((k) => (
          <td
            key={k}
            className={`px-3 py-2 text-right font-mono ${k === bestKey ? "font-bold text-ink" : "text-ink-3"}`}
          >
            {fmtQ(row[k])}
          </td>
        ))}
      </>
    );
  }
  return (
    <>
      <td className="px-3 py-2 text-right font-mono font-bold text-ink">{fmtQ(row.best_lap)}</td>
      <td className="px-3 py-2 text-right font-mono text-ink-3">
        {row.gap != null ? `+${row.gap.toFixed(3)}` : ""}
      </td>
      <td className="px-3 py-2 text-right font-mono text-ink-3">{row.laps}</td>
    </>
  );
}

function headline(kind: string, row: SessionResultRow): string {
  if (kind === "race") return row.time ?? row.status ?? "";
  if (kind === "quali") return fmtQ(row.q3 ?? row.q2 ?? row.q1);
  return fmtQ(row.best_lap);
}

export function SessionResultsModal({
  target,
  onClose,
}: {
  target: ResultsTarget | null;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["sessionResults", target?.year, target?.gp, target?.session],
    queryFn: () => api.sessionResults(target!.year, target!.gp, target!.session),
    enabled: !!target,
    staleTime: Infinity,
  });

  const podium = data?.rows.slice(0, 3) ?? [];
  // Orden visual del podio: P2 · P1 · P3
  const podiumOrder = podium.length === 3 ? [podium[1], podium[0], podium[2]] : podium;

  return (
    <Sheet
      open={!!target}
      onClose={onClose}
      eyebrow={target ? `Resultados · ${target.sessionName}` : undefined}
      title={
        target && (
          <>
            {target.gp} <span className="text-ink-3">{target.year}</span>
          </>
        )
      }
    >
      {isLoading && (
        <div className="space-y-3">
          <div className="skeleton h-36 w-full" />
          <div className="skeleton h-64 w-full" />
        </div>
      )}
      {isError && (
        <p className="py-10 text-center text-sm text-red-300">
          No se pudieron cargar los resultados de esta sesión.
        </p>
      )}

      {data && (
        <>
          {/* Podio */}
          <div className="mb-6 flex items-end justify-center gap-2 sm:gap-4">
            {podiumOrder.map((row, i) => {
              const isP1 = row.position === 1;
              return (
                <div
                  key={row.driver}
                  style={{ "--i": i } as React.CSSProperties}
                  className={`stagger flex w-28 flex-col items-center rounded-[26px] px-3 pb-3 sm:w-36 ${
                    isP1
                      ? "bg-gradient-to-b from-f1red/25 to-white/[0.03] pt-4 shadow-[inset_0_0_0_1px_rgb(225_6_0/0.45)] sm:-mt-4"
                      : "mt-2 bg-white/[0.04] pt-3 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]"
                  }`}
                >
                  <DriverAvatar
                    url={row.headshot_url}
                    color={row.team_color}
                    size={isP1 ? 68 : 54}
                    alt={row.full_name}
                  />
                  <span
                    className={`font-wide mt-2 ${isP1 ? "text-2xl text-f1red-bright" : "text-lg text-ink-2"}`}
                  >
                    P{row.position}
                  </span>
                  <span className="text-sm font-bold">{row.driver}</span>
                  <span className="font-mono text-[11px] text-ink-3">
                    {headline(data.kind, row)}
                  </span>
                  <span
                    className="mt-2 h-1 w-10 rounded-full"
                    style={{ background: row.team_color }}
                  />
                </div>
              );
            })}
          </div>

          {/* Tabla completa */}
          <table className="w-full border-separate border-spacing-y-1 text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.15em] text-ink-3">
                <th className="px-3 py-2">Pos</th>
                <th className="px-3 py-2">Piloto</th>
                {KIND_COLUMNS[data.kind].map((c) => (
                  <th key={c} className="px-3 py-2 text-right">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr
                  key={row.driver}
                  className="bg-white/[0.025] transition-colors hover:bg-white/[0.06] [&>td:first-child]:rounded-l-full [&>td:last-child]:rounded-r-full"
                >
                  <td className="font-wide px-3 py-2 pl-4">{row.position ?? "—"}</td>
                  <td className="px-3 py-2">
                    <DriverTag
                      code={row.driver}
                      fullName={row.full_name}
                      color={row.team_color}
                      headshot={row.headshot_url}
                      size={26}
                      hideNameOnMobile
                    />
                  </td>
                  <RowCells kind={data.kind} row={row} />
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Sheet>
  );
}
