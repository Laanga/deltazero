"use client";

import { Activity, Disc3, Flag, Play, Timer } from "lucide-react";
import { useState } from "react";

import { ChartPanel, ChartSkeleton, EmptyState } from "@/components/ChartPanel";
import { DriverAvatar } from "@/components/DriverAvatar";
import { Button, IconButton } from "@/components/ui/Button";
import { Badge, Chip } from "@/components/ui/Chip";
import { Dropdown } from "@/components/ui/Dropdown";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Sheet } from "@/components/ui/Sheet";

const GPS = [
  "Bahrain Grand Prix",
  "Saudi Arabian Grand Prix",
  "Australian Grand Prix",
  "Japanese Grand Prix",
  "Monaco Grand Prix",
];

export function LabShowcase() {
  const [tab, setTab] = useState<"a" | "b" | "c" | "d">("a");
  const [gp, setGp] = useState(GPS[0]);
  const [chips, setChips] = useState([true, false, false]);
  const [sheet, setSheet] = useState(false);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <header>
        <p className="eyebrow">DeltaZero · Sistema de diseño</p>
        <h1 className="font-wide mt-2 text-3xl uppercase">Liquid Lab</h1>
      </header>

      <ChartPanel title="Botones" subtitle="cápsula · pulsación con spring">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primario</Button>
          <Button>Secundario</Button>
          <Button variant="tinted">Tintado</Button>
          <Button variant="ghost">Fantasma</Button>
          <Button size="sm">Pequeño</Button>
          <Button disabled>Desactivado</Button>
          <IconButton aria-label="Reproducir" variant="primary" size="lg">
            <Play size={18} fill="currentColor" className="ml-0.5" />
          </IconButton>
        </div>
      </ChartPanel>

      <ChartPanel title="Control segmentado y chips">
        <div className="space-y-4">
          <SegmentedControl
            ariaLabel="Demo"
            value={tab}
            onChange={setTab}
            segments={[
              { id: "a", label: "Telemetría", icon: <Activity size={15} /> },
              { id: "b", label: "Vueltas", icon: <Timer size={15} /> },
              { id: "c", label: "Carrera", icon: <Flag size={15} /> },
              { id: "d", label: "Estrategia", icon: <Disc3 size={15} /> },
            ]}
          />
          <div className="flex flex-wrap gap-2">
            {["Sin boxes", "Sin vuelta 1", "Sin SC/VSC"].map((l, i) => (
              <Chip
                key={l}
                on={chips[i]}
                onClick={() => setChips((c) => c.map((v, k) => (k === i ? !v : v)))}
              >
                {l}
              </Chip>
            ))}
            <Badge>CEST</Badge>
            <Badge>S2</Badge>
          </div>
        </div>
      </ChartPanel>

      <div className="grid gap-6 md:grid-cols-2">
        <ChartPanel title="Selector" exportName="demo" csvRows={() => [["a"], [1]]}>
          <div className="flex flex-wrap items-end gap-4">
            <Dropdown
              label="Gran Premio"
              value={gp}
              selectedKey={gp}
              options={GPS}
              display={(g) => ({ key: g, text: g, sub: "Circuito" })}
              onSelect={setGp}
              className="w-64"
            />
            <Dropdown
              compact
              label="Vuelta"
              value="Más rápida"
              options={["fastest"]}
              display={(o) => ({ key: o, text: o })}
              onSelect={() => {}}
            />
          </div>
        </ChartPanel>
        <ChartPanel title="Avatares y sheet">
          <div className="flex items-center gap-3">
            <DriverAvatar
              url="/drivers/2026-VER.webp"
              color="#3671C6"
              size={48}
              alt="Max Verstappen"
              ring
            />
            <DriverAvatar
              url="/drivers/2026-LEC.webp"
              color="#E8002D"
              size={40}
              alt="Charles Leclerc"
            />
            <DriverAvatar url={null} color="#FF8000" size={40} alt="Lando Norris" />
            <Button className="ml-auto" onClick={() => setSheet(true)}>
              Abrir sheet
            </Button>
          </div>
        </ChartPanel>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ChartSkeleton height={160} />
        <EmptyState message="Estado vacío" hint="Texto aclaratorio de segunda línea." />
      </div>

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        eyebrow="Resultados · Carrera"
        title="Monaco Grand Prix 2025"
      >
        <p className="pb-6 text-sm text-ink-2">
          Contenido de la hoja modal. En móvil sube desde abajo con asa.
        </p>
      </Sheet>
    </main>
  );
}
