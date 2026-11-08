"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Download, FileSpreadsheet, ImageDown } from "lucide-react";
import { useRef, useState } from "react";

import { downloadCSV, exportSvgToPng } from "@/lib/export";

/** Tarjeta de contenido con título, subtítulo y exportación opcional (PNG / CSV). */
export function ChartPanel({
  title,
  subtitle,
  children,
  className = "",
  exportName,
  csvRows,
  allowPng = true,
  actions,
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
  /** Controles extra a la derecha del título. */
  actions?: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handlePng = async () => {
    setOpen(false);
    if (!ref.current) return;
    setBusy(true);
    try {
      await exportSvgToPng(ref.current, exportName ?? title);
    } catch {
      /* gráfica no disponible aún */
    } finally {
      setBusy(false);
    }
  };

  const handleCsv = () => {
    setOpen(false);
    if (csvRows) downloadCSV(exportName ?? title, csvRows());
  };

  return (
    <section ref={ref} className={`panel panel-glow animate-rise p-5 md:p-6 ${className}`}>
      <header className="mb-4 flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="font-wide text-[13px] font-bold uppercase tracking-[0.1em]">{title}</h2>
        {subtitle && <span className="text-xs font-medium text-ink-3">{subtitle}</span>}

        <div className="ml-auto flex items-center gap-2">
          {actions}
          {exportName && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                disabled={busy}
                aria-haspopup="menu"
                aria-expanded={open}
                className="pressable fill-control flex h-8 items-center gap-1.5 rounded-full px-3 text-[10px] font-bold uppercase tracking-wider text-ink-3 hover:text-ink disabled:opacity-50"
              >
                <Download size={12} />
                {busy ? "…" : "Exportar"}
              </button>
              <AnimatePresence>
                {open && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
                    <motion.div
                      role="menu"
                      initial={{ opacity: 0, y: -4, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ type: "spring", stiffness: 520, damping: 36 }}
                      onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
                      className="glass absolute right-0 top-full z-40 mt-2 flex w-44 origin-top-right flex-col rounded-[20px] p-1.5"
                    >
                      {allowPng && (
                        <button
                          role="menuitem"
                          autoFocus
                          onClick={handlePng}
                          className="flex items-center gap-2.5 rounded-[14px] px-3 py-2 text-left text-xs font-semibold text-ink hover:bg-white/[0.09]"
                        >
                          <ImageDown size={14} className="text-ink-3" /> Imagen PNG
                        </button>
                      )}
                      {csvRows && (
                        <button
                          role="menuitem"
                          autoFocus={!allowPng}
                          onClick={handleCsv}
                          className="flex items-center gap-2.5 rounded-[14px] px-3 py-2 text-left text-xs font-semibold text-ink hover:bg-white/[0.09]"
                        >
                          <FileSpreadsheet size={14} className="text-ink-3" /> Datos CSV
                        </button>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </header>
      {children}
    </section>
  );
}

export function ChartSkeleton({
  height = 280,
  className = "",
}: {
  height?: number;
  className?: string;
}) {
  return <div className={`skeleton w-full ${className}`} style={{ height }} />;
}

export function EmptyState({
  message,
  hint,
  tone = "info",
  action,
}: {
  message: string;
  /** Segunda línea aclaratoria (p. ej. "los datos tardan ~15 min tras la sesión"). */
  hint?: string;
  /** "info" para estados normales · "error" para fallos reales. */
  tone?: "info" | "error";
  action?: React.ReactNode;
}) {
  const dot = tone === "error" ? "bg-f1red" : "bg-white/20";
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className="panel flex min-h-64 flex-col items-center justify-center gap-3 px-6 py-12 text-center"
    >
      <div className="flex gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-2.5 w-2.5 animate-pulse rounded-full ${dot}`}
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
      <p className={`text-sm font-semibold ${tone === "error" ? "text-red-300" : "text-ink"}`}>
        {message}
      </p>
      {hint && <p className="max-w-md text-xs leading-relaxed text-ink-3">{hint}</p>}
      {action}
    </div>
  );
}
