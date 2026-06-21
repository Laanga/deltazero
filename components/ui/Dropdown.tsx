"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ChevronDown } from "lucide-react";
import { useRef, useState } from "react";

gsap.registerPlugin(useGSAP);

/** Desplegable genérico con animación de entrada; reutilizable en toda la app. */
export function Dropdown<T>({
  label,
  value,
  options,
  display,
  onSelect,
  disabled,
}: {
  label: string;
  value: string;
  options: T[];
  display: (option: T) => { key: string; text: string; sub?: string };
  onSelect: (option: T) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (open) {
        gsap.fromTo(
          listRef.current,
          { opacity: 0, y: -8, scaleY: 0.95 },
          { opacity: 1, y: 0, scaleY: 1, duration: 0.25, ease: "power2.out" },
        );
        gsap.from(".dd-item", { opacity: 0, x: -10, duration: 0.3, stagger: 0.015, ease: "power2.out" });
      }
    },
    { dependencies: [open], scope: listRef },
  );

  return (
    <div className="relative min-w-44">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <button
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className={`flex w-full items-center justify-between gap-2 rounded-md border px-4 py-2.5 text-left text-sm font-semibold transition-all
          ${disabled ? "cursor-not-allowed border-edge/50 bg-panel/40 text-zinc-600" : "border-edge bg-panel hover:border-f1red/50 hover:bg-panel-light"}`}
      >
        <span className="truncate">{value}</span>
        <ChevronDown size={16} className={`shrink-0 text-zinc-500 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            ref={listRef}
            className="absolute z-20 mt-2 max-h-80 w-full min-w-56 origin-top overflow-y-auto rounded-md border border-edge bg-panel-light shadow-2xl shadow-black/60"
          >
            {options.map((opt) => {
              const d = display(opt);
              return (
                <button
                  key={d.key}
                  className="dd-item flex w-full flex-col px-4 py-2.5 text-left text-sm transition-colors hover:bg-f1red/15"
                  onClick={() => {
                    onSelect(opt);
                    setOpen(false);
                  }}
                >
                  <span className="font-semibold">{d.text}</span>
                  {d.sub && <span className="text-xs text-zinc-500">{d.sub}</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
