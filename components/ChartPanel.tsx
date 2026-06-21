"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Download } from "lucide-react";
import { useRef, useState } from "react";

import { downloadCSV, exportSvgToPng } from "@/lib/export";

gsap.registerPlugin(useGSAP);

export function ChartPanel({
  title,
  subtitle,
  children,
  className = "",
  exportName,
  csvRows,
  allowPng = true,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  /** Si se indica, muestra controles para exportar la gráfica (PNG) y, si hay csvRows, los datos (CSV). */
  exportName?: string;
  /** Devuelve las filas del CSV (la primera es la cabecera). */
  csvRows?: () => (string | number | null)[][];
  /** Desactiva el PNG en paneles que no son SVG (tablas, heatmaps HTML). */
  allowPng?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useGSAP(
    () => {
      gsap.from(ref.current, {
        opacity: 0,
        y: 28,
        duration: 0.6,
        ease: "power3.out",
        clearProps: "opacity,transform",
      });
    },
    { scope: ref },
  );

  const handlePng = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      await exportSvgToPng(ref.current, exportName ?? title);
    } catch {
      /* gráfica no disponible aún */
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  const handleCsv = () => {
    if (!csvRows) return;
    try {
      downloadCSV(exportName ?? title, csvRows());
    } finally {
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className={`panel panel-glow p-5 ${className}`}>
      <div className="mb-4 flex items-baseline gap-3">
        <span className="h-4 w-1 rounded-full bg-f1red" />
        <h2 className="font-wide text-sm font-bold uppercase tracking-[0.1em]">{title}</h2>
        {subtitle && <span className="text-xs font-medium text-zinc-500">{subtitle}</span>}

        {exportName && (
          <div className="relative ml-auto self-center">
            <button
              onClick={() => setOpen((o) => !o)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              disabled={busy}
              title="Exportar"
              className="flex items-center gap-1 rounded border border-edge px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 transition-colors hover:border-f1red/50 hover:text-zinc-200 disabled:opacity-50"
            >
              <Download size={12} />
              {busy ? "…" : "Exportar"}
            </button>
            {open && (
              <div className="absolute right-0 top-full z-20 mt-1 flex w-28 flex-col overflow-hidden rounded-md border border-edge bg-panel-light shadow-xl">
                {allowPng && (
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handlePng}
                    className="px-3 py-2 text-left text-xs font-semibold text-zinc-300 transition-colors hover:bg-f1red/15 hover:text-white"
                  >
                    Imagen PNG
                  </button>
                )}
                {csvRows && (
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleCsv}
                    className={`px-3 py-2 text-left text-xs font-semibold text-zinc-300 transition-colors hover:bg-f1red/15 hover:text-white ${allowPng ? "border-t border-edge" : ""}`}
                  >
                    Datos CSV
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return <div className="skeleton w-full" style={{ height }} />;
}

export function EmptyState({
  message,
  hint,
  tone = "info",
}: {
  message: string;
  /** Segunda línea aclaratoria (p. ej. "los datos tardan ~15 min tras la sesión"). */
  hint?: string;
  /** "info" para estados normales · "error" para fallos reales. */
  tone?: "info" | "error";
}) {
  const dot = tone === "error" ? "bg-f1red" : "bg-zinc-700";
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3 px-6 text-center text-zinc-500">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-3 w-3 rounded-sm ${dot}`}
            style={{
              animation: `pulse 1.2s ease-in-out ${i * 0.15}s infinite`,
            }}
          />
        ))}
      </div>
      <p className={`text-sm ${tone === "error" ? "text-red-400" : "text-zinc-300"}`}>{message}</p>
      {hint && <p className="max-w-sm text-xs text-zinc-600">{hint}</p>}
    </div>
  );
}
