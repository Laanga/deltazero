"use client";

import { motion } from "framer-motion";
import { useId, useRef } from "react";

export interface Segment<T extends string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
}

/**
 * Control segmentado en cápsula (estilo iOS): el indicador se desliza con un
 * spring entre opciones. Navegable con flechas; semántica de pestañas.
 */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  size = "md",
  className = "",
  ariaLabel,
}: {
  segments: Segment<T>[];
  value: T;
  onChange: (id: T) => void;
  size?: "sm" | "md";
  className?: string;
  ariaLabel: string;
}) {
  const layoutId = useId();
  const ref = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = segments.findIndex((s) => s.id === value);
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % segments.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + segments.length) % segments.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = segments.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(segments[next].id);
    ref.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus();
  };

  const pad = size === "sm" ? "h-8 px-3 text-[11px]" : "h-10 px-4 text-[13px]";

  return (
    <div
      ref={ref}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={`fill-control relative inline-flex max-w-full gap-0.5 overflow-x-auto rounded-full p-1 [scrollbar-width:none] ${className}`}
    >
      {segments.map((s) => {
        const active = s.id === value;
        return (
          <button
            key={s.id}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(s.id)}
            className={`pressable relative flex shrink-0 items-center gap-2 rounded-full font-bold uppercase tracking-wide ${pad}
              ${active ? "text-white" : "text-ink-3 hover:text-ink"}`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-full bg-f1red shadow-[0_6px_18px_-6px_rgb(225_6_0/0.8),inset_0_1px_0_rgb(255_255_255/0.25)]"
                transition={{ type: "spring", stiffness: 520, damping: 38 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {s.icon}
              {s.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
