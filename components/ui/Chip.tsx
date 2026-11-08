import { Check } from "lucide-react";

/** Interruptor en cápsula (filtros). */
export function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className={`pressable inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[11px] font-bold uppercase tracking-wider
        ${on ? "bg-f1red/18 text-white shadow-[inset_0_0_0_1px_rgb(225_6_0/0.5)]" : "fill-control text-ink-3 hover:text-ink"}`}
    >
      {on && <Check size={12} strokeWidth={3} className="text-f1red-bright" />}
      {children}
    </button>
  );
}

/** Pastilla informativa pequeña (país, zona horaria, sector…). */
export function Badge({
  children,
  className = "",
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center rounded-full bg-white/[0.07] px-1.5 py-px font-mono text-[9px] font-bold tracking-wider text-ink-2 ${className}`}
    >
      {children}
    </span>
  );
}
