"use client";

import { useGSAP } from "@gsap/react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import gsap from "gsap";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { DriverAvatar } from "@/components/DriverAvatar";
import { DriverTag } from "@/components/DriverTag";
import { api } from "@/lib/api";
import type { SessionResultRow } from "@/lib/types";
import { formatLapTime } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

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
        <td className="px-3 py-2 text-right font-mono text-zinc-500">{row.grid ?? "—"}</td>
        <td className="px-3 py-2 text-right font-mono">{row.time ?? row.status ?? "—"}</td>
        <td className="px-3 py-2 text-right font-mono font-bold text-zinc-100">
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
            className={`px-3 py-2 text-right font-mono ${k === bestKey ? "font-bold text-zinc-100" : "text-zinc-500"}`}
          >
            {fmtQ(row[k])}
          </td>
        ))}
      </>
    );
  }
  return (
    <>
      <td className="px-3 py-2 text-right font-mono font-bold text-zinc-100">{fmtQ(row.best_lap)}</td>
      <td className="px-3 py-2 text-right font-mono text-zinc-500">
        {row.gap != null ? `+${row.gap.toFixed(3)}` : ""}
      </td>
      <td className="px-3 py-2 text-right font-mono text-zinc-500">{row.laps}</td>
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
  const ref = useRef<HTMLDivElement>(null);

  // El portal necesita document: solo tras montar en cliente
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Escape cierra y se bloquea el scroll de la página mientras el modal está abierto
  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [target, onClose]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["sessionResults", target?.year, target?.gp, target?.session],
    queryFn: () => api.sessionResults(target!.year, target!.gp, target!.session),
    enabled: !!target,
    staleTime: Infinity,
  });

  useGSAP(
    () => {
      if (!data) return;
      gsap.from(".podium-card", {
        opacity: 0,
        y: 40,
        scale: 0.85,
        duration: 0.55,
        stagger: 0.12,
        ease: "back.out(1.7)",
        clearProps: "opacity,transform",
      });
      gsap.from(".res-row", {
        opacity: 0,
        x: -24,
        duration: 0.4,
        stagger: 0.025,
        ease: "power2.out",
        clearProps: "opacity,transform",
        delay: 0.3,
      });
    },
    { dependencies: [data], scope: ref },
  );

  const podium = data?.rows.slice(0, 3) ?? [];
  // Orden visual del podio: P2 · P1 · P3
  const podiumOrder = podium.length === 3 ? [podium[1], podium[0], podium[2]] : podium;

  if (!mounted) return null;

  // Portal a <body>: dentro del árbol de vistas hay ancestros con transform/filter
  // (animaciones de framer-motion) que convierten el `fixed` en relativo a ellos —
  // el modal salía descentrado y con el scroll de la página activo detrás.
  return createPortal(
    <AnimatePresence>
      {target && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-90 flex items-center justify-center bg-carbon/80 p-4 backdrop-blur-md md:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Resultados ${target.sessionName} · ${target.gp} ${target.year}`}
          onClick={onClose}
        >
          <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="panel flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden p-0"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera fija: el cierre siempre visible aunque la tabla haga scroll */}
            <div className="flex items-start justify-between gap-4 border-b border-edge p-6 pb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-f1red">
                  Resultados · {target.sessionName}
                </p>
                <h2 className="font-wide mt-1 text-2xl uppercase leading-none">
                  {target.gp} <span className="text-zinc-500">{target.year}</span>
                </h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Cerrar"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-edge text-zinc-500 transition-colors hover:border-f1red hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto p-6 pt-5">
            {isLoading && (
              <div className="space-y-3">
                <div className="skeleton h-36 w-full" />
                <div className="skeleton h-64 w-full" />
              </div>
            )}
            {isError && (
              <p className="py-10 text-center text-sm text-red-400">
                No se pudieron cargar los resultados de esta sesión.
              </p>
            )}

            {data && (
              <>
                {/* Podio */}
                <div className="mb-6 flex items-end justify-center gap-4">
                  {podiumOrder.map((row) => {
                    const isP1 = row.position === 1;
                    return (
                      <div
                        key={row.driver}
                        className={`podium-card flex w-36 flex-col items-center rounded-md border bg-panel-light px-3 pb-3 ${
                          isP1 ? "-mt-4 border-f1red pt-4" : "mt-2 border-edge pt-3"
                        }`}
                      >
                        <DriverAvatar
                          url={row.headshot_url}
                          color={row.team_color}
                          size={isP1 ? 72 : 56}
                          alt={row.full_name}
                        />
                        <span className={`font-wide mt-2 ${isP1 ? "text-2xl text-f1red" : "text-lg text-zinc-400"}`}>
                          P{row.position}
                        </span>
                        <span className="text-sm font-bold">{row.driver}</span>
                        <span className="font-mono text-xs text-zinc-500">{headline(data.kind, row)}</span>
                        <span
                          className="mt-2 h-1 w-full rounded-full"
                          style={{ background: row.team_color }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Tabla completa */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-edge text-left text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                      <th className="px-3 py-2">Pos</th>
                      <th className="px-3 py-2">Piloto</th>
                      {KIND_COLUMNS[data.kind].map((c) => (
                        <th key={c} className="px-3 py-2 text-right">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row) => (
                      <tr key={row.driver} className="res-row border-b border-edge/40 transition-colors hover:bg-panel-light">
                        <td className="px-3 py-2 font-wide">{row.position ?? "—"}</td>
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
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
