"use client";

import { motion } from "framer-motion";
import { Activity, CalendarDays, Disc3, Flag, Timer } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { SegmentedControl, type Segment } from "@/components/ui/SegmentedControl";
import { useSessionStore, type ViewTab } from "@/store/sessionStore";

type AnalysisTab = Exclude<ViewTab, "calendar">;

const TABS: Segment<AnalysisTab>[] = [
  { id: "telemetry", label: "Telemetría", icon: <Activity size={15} /> },
  { id: "laps", label: "Vueltas", icon: <Timer size={15} /> },
  { id: "race", label: "Carrera", icon: <Flag size={15} /> },
  { id: "strategy", label: "Estrategia", icon: <Disc3 size={15} /> },
];

/** Pestañas de análisis en escritorio (control segmentado). */
export function TabNav() {
  const { tab, setTab } = useSessionStore(useShallow((s) => ({ tab: s.tab, setTab: s.setTab })));
  if (tab === "calendar") return null;
  // En móvil la navegación vive en la barra inferior
  return (
    <div className="hidden md:block">
      <SegmentedControl
        ariaLabel="Vistas de análisis"
        segments={TABS}
        value={tab}
        onChange={setTab}
      />
    </div>
  );
}

const MOBILE_TABS: { id: ViewTab; label: string; icon: React.ReactNode }[] = [
  { id: "telemetry", label: "Telemetría", icon: <Activity size={20} /> },
  { id: "laps", label: "Vueltas", icon: <Timer size={20} /> },
  { id: "race", label: "Carrera", icon: <Flag size={20} /> },
  { id: "strategy", label: "Estrategia", icon: <Disc3 size={20} /> },
  { id: "calendar", label: "Temporada", icon: <CalendarDays size={20} /> },
];

/** Barra de pestañas flotante inferior (móvil), estilo iOS. */
export function MobileTabBar() {
  const { tab, setTab } = useSessionStore(useShallow((s) => ({ tab: s.tab, setTab: s.setTab })));
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 md:hidden"
    >
      <div className="glass mx-auto flex max-w-md items-stretch justify-between rounded-full p-1.5">
        {MOBILE_TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => setTab(t.id)}
              className={`pressable relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 text-[9.5px] font-bold tracking-wide
                ${active ? "text-white" : "text-ink-3"}`}
            >
              {active && (
                <motion.span
                  layoutId="mobile-tab"
                  className="absolute inset-0 rounded-full bg-white/[0.12]"
                  transition={{ type: "spring", stiffness: 520, damping: 38 }}
                />
              )}
              <span className={`relative ${active ? "text-f1red-bright" : ""}`}>{t.icon}</span>
              <span className="relative truncate">{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
