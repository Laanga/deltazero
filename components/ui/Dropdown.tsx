"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export interface DropdownOption {
  key: string;
  text: string;
  sub?: string;
}

/**
 * Selector en cápsula con menú de cristal (listbox accesible).
 * - Teclado: flechas, Home/End, Enter/Espacio, Escape, búsqueda por primera letra.
 * - Escritorio: menú flotante bajo el botón. Móvil: bottom sheet.
 */
export function Dropdown<T>({
  label,
  value,
  options,
  display,
  onSelect,
  selectedKey,
  disabled,
  compact = false,
  className = "",
}: {
  label: string;
  value: string;
  options: T[];
  display: (option: T) => DropdownOption;
  onSelect: (option: T) => void;
  /** Clave de la opción activa (para el check y el foco inicial). */
  selectedKey?: string | null;
  disabled?: boolean;
  /** Variante en línea: etiqueta a la izquierda, cápsula baja. */
  compact?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const items = options.map(display);

  const openMenu = () => {
    if (disabled || !items.length) return;
    const sel = items.findIndex((d) => d.key === selectedKey);
    setActive(sel >= 0 ? sel : 0);
    setOpen(true);
  };

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  const choose = (i: number) => {
    onSelect(options[i]);
    close();
  };

  // Foco al listbox al abrir y opción activa visible
  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onListKey = (e: React.KeyboardEvent) => {
    const n = items.length;
    if (e.key === "ArrowDown") setActive((a) => Math.min(n - 1, a + 1));
    else if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(n - 1);
    else if (e.key === "Enter" || e.key === " ") choose(active);
    else if (e.key === "Escape" || e.key === "Tab") close(e.key === "Escape");
    else if (e.key.length === 1) {
      const ch = e.key.toLowerCase();
      const from = (active + 1) % n;
      for (let k = 0; k < n; k++) {
        const i = (from + k) % n;
        if (
          items[i].text
            .toLowerCase()
            .replace(/^r\d+ · /, "")
            .startsWith(ch)
        ) {
          setActive(i);
          break;
        }
      }
      return;
    } else return;
    e.preventDefault();
  };

  return (
    <div
      className={`relative ${compact ? "inline-flex items-center gap-2" : "min-w-44"} ${className}`}
    >
      <p className={`eyebrow ${compact ? "" : "mb-1.5 pl-3"}`}>{label}</p>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            openMenu();
          }
        }}
        className={`pressable fill-control flex w-full items-center justify-between gap-2 rounded-full text-left font-semibold
          ${compact ? "h-8 pl-3.5 pr-2.5 text-xs" : "h-11 pl-4 pr-3 text-sm"}
          ${disabled ? "cursor-not-allowed text-ink-3 opacity-60" : "hover:bg-white/10"}`}
      >
        <span className="truncate">{value}</span>
        <ChevronDown
          size={compact ? 14 : 16}
          className={`shrink-0 text-ink-3 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Fondo: cierra al pulsar fuera; en móvil oscurece como un sheet */}
            <motion.div
              className="fixed inset-0 z-40 max-md:bg-black/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => close(false)}
            />
            <motion.div
              ref={listRef}
              id={listId}
              role="listbox"
              tabIndex={-1}
              aria-label={label}
              aria-activedescendant={`${listId}-${active}`}
              onKeyDown={onListKey}
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 520, damping: 36 }}
              className={`glass z-50 overflow-y-auto overscroll-contain p-1.5 outline-none
                max-md:fixed max-md:inset-x-2 max-md:bottom-2 max-md:max-h-[65dvh] max-md:rounded-[28px] max-md:pb-[max(0.375rem,env(safe-area-inset-bottom))]
                md:absolute md:left-0 md:mt-2 md:max-h-80 md:w-full md:min-w-60 md:origin-top md:rounded-[22px]
                ${compact ? "md:top-full" : ""}`}
            >
              <p className="eyebrow px-3 pb-1 pt-2 md:hidden">{label}</p>
              {items.map((d, i) => {
                const selected = d.key === selectedKey;
                return (
                  <div
                    key={d.key}
                    id={`${listId}-${i}`}
                    data-idx={i}
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(i)}
                    className={`flex cursor-pointer items-center gap-3 rounded-[14px] px-3 py-2.5 text-sm transition-colors
                      ${i === active ? "bg-white/[0.09]" : ""}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate ${selected ? "font-bold text-white" : "font-semibold text-ink"}`}
                      >
                        {d.text}
                      </span>
                      {d.sub && <span className="block truncate text-xs text-ink-3">{d.sub}</span>}
                    </span>
                    {selected && (
                      <Check size={15} strokeWidth={3} className="shrink-0 text-f1red-bright" />
                    )}
                  </div>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
