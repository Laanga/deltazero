"use client";

import { Check, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Popover } from "@/components/ui/Popover";

export interface DropdownOption {
  key: string;
  text: string;
  sub?: string;
}

/**
 * Selector en cápsula con menú flotante (listbox accesible).
 * - Teclado: flechas, Home/End, Enter/Espacio, Escape, búsqueda por primera letra.
 * - El menú se renderiza en un portal (Popover): nunca queda tapado por otras
 *   tarjetas, la cabecera o la barra de pestañas. En móvil es un bottom sheet.
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
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const setButtonRef = useCallback((el: HTMLButtonElement | null) => {
    buttonRef.current = el;
    setAnchor(el);
  }, []);
  const listRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();

  const items = options.map(display);

  const openMenu = () => {
    if (disabled || !items.length) return;
    const sel = items.findIndex((d) => d.key === selectedKey);
    setActive(sel >= 0 ? sel : 0);
    setOpen(true);
  };

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }, []);

  const choose = (i: number) => {
    onSelect(options[i]);
    close();
  };

  // El listbox se monta un frame después (cuando el Popover ha medido): foco al montar
  const setListRef = useCallback((el: HTMLDivElement | null) => {
    listRef.current = el;
    if (!el) return;
    el.focus({ preventScroll: true });
    // Abre centrado en la opción elegida (p. ej. R13 en una lista de 24 GPs)
    el.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "center" });
  }, []);

  // Opción activa siempre visible
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
        ref={setButtonRef}
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
          ${open ? "bg-white/[0.12] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.18)]" : ""}
          ${disabled ? "cursor-not-allowed text-ink-3 opacity-60" : "hover:bg-white/10"}`}
      >
        <span className="truncate">{value}</span>
        <ChevronDown
          size={compact ? 14 : 16}
          className={`shrink-0 text-ink-3 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <Popover
        ref={setListRef}
        open={open}
        onClose={() => close(false)}
        anchor={anchor}
        minWidth={compact ? 220 : 260}
        sheetTitle={label}
        id={listId}
        role="listbox"
        tabIndex={-1}
        aria-label={label}
        aria-activedescendant={`${listId}-${active}`}
        onKeyDown={onListKey}
      >
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
                ${i === active ? "bg-white/[0.1]" : ""}`}
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
      </Popover>
    </div>
  );
}
