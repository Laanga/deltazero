"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Activity, Disc3, Flag, Timer } from "lucide-react";
import { useRef } from "react";

import { useSessionStore, type ViewTab } from "@/store/sessionStore";

gsap.registerPlugin(useGSAP);

const TABS: { id: ViewTab; label: string; icon: React.ReactNode }[] = [
  { id: "telemetry", label: "Telemetría", icon: <Activity size={16} /> },
  { id: "laps", label: "Vueltas", icon: <Timer size={16} /> },
  { id: "race", label: "Carrera", icon: <Flag size={16} /> },
  { id: "strategy", label: "Estrategia", icon: <Disc3 size={16} /> },
];

export function TabNav() {
  const ref = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const { tab, setTab } = useSessionStore();

  useGSAP(
    () => {
      const active = ref.current?.querySelector<HTMLButtonElement>(`[data-tab="${tab}"]`);
      if (active && indicatorRef.current) {
        gsap.to(indicatorRef.current, {
          x: active.offsetLeft,
          width: active.offsetWidth,
          duration: 0.45,
          ease: "elastic.out(1, 0.75)",
        });
      }
    },
    { dependencies: [tab], scope: ref },
  );

  return (
    <div ref={ref} className="relative flex w-fit gap-1 rounded-md border border-edge bg-panel p-1">
      <div
        ref={indicatorRef}
        className="absolute top-1 bottom-1 left-0 rounded bg-f1red/90 shadow-lg shadow-f1red/30"
        style={{ width: 0 }}
      />
      {TABS.map((t) => (
        <button
          key={t.id}
          data-tab={t.id}
          onClick={() => setTab(t.id)}
          className={`relative z-10 flex items-center gap-2 rounded px-4 py-2 text-sm font-bold uppercase tracking-wide transition-colors duration-300
            ${tab === t.id ? "text-white" : "text-zinc-500 hover:text-zinc-200"}`}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}
