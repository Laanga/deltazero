"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Trophy } from "lucide-react";
import { useRef, useState } from "react";

import { ChartSkeleton } from "@/components/ChartPanel";
import { NationalityBadge } from "@/components/NationalityBadge";
import { useDriverStandings } from "@/hooks/useF1Data";
import { DRIVER_PHOTOS, TEAM_LOGOS } from "@/lib/champAssets";
import type { DriverStanding } from "@/lib/types";
import { useSessionStore } from "@/store/sessionStore";

gsap.registerPlugin(useGSAP);

const TEAM_COLORS: Record<string, string> = {
  red_bull:     "#3671C6",
  mercedes:     "#27F4D2",
  ferrari:      "#E8002D",
  mclaren:      "#FF8000",
  aston_martin: "#229971",
  alpine:       "#FF87BC",
  williams:     "#64C4FF",
  rb:           "#6692FF",
  racing_bulls: "#6692FF",
  kick_sauber:  "#52E252",
  sauber:       "#52E252",
  haas:         "#B6BABD",
};

function teamColor(id: string) {
  return TEAM_COLORS[id] ?? "#888";
}

function DriverPhoto({ code, size }: { code: string; size: number }) {
  const [failed, setFailed] = useState(false);
  const src = DRIVER_PHOTOS[code];
  if (!src || failed) return null;
  return (
    <img
      src={src}
      alt={code}
      onError={() => setFailed(true)}
      className="pointer-events-none select-none object-contain object-bottom"
      style={{ width: size, height: size, filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.7))" }}
    />
  );
}

function TeamLogo({ id, size = 28 }: { id: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const src = TEAM_LOGOS[id];
  if (!src || failed) return null;
  return (
    <img
      src={src}
      alt={id}
      onError={() => setFailed(true)}
      className="object-contain"
      style={{ width: size, height: size }}
    />
  );
}

function PodiumCard({ driver, rank }: { driver: DriverStanding; rank: 1 | 2 | 3 }) {
  const color = teamColor(driver.team_id);
  const topPad   = rank === 1 ? "pt-0"  : rank === 2 ? "pt-10" : "pt-16";
  const codeSize = rank === 1 ? "text-8xl" : "text-6xl";
  const photoSize = rank === 1 ? 220 : 170;
  const metal    = rank === 1 ? "#e8c352" : rank === 2 ? "#c0c4cc" : "#c8845a";

  return (
    <div className={`podium-card flex flex-col ${topPad}`}>
      <div
        className="panel relative flex flex-1 flex-col overflow-hidden"
        style={{ borderColor: `${color}55`, boxShadow: `0 0 40px ${color}18` }}
      >
        {/* Team color stripe */}
        <div className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />

        {/* Faint position watermark */}
        <span
          className="pointer-events-none absolute -right-2 -top-4 select-none font-black italic leading-none text-white/[0.04]"
          style={{ fontSize: "10rem" }}
        >
          {rank}
        </span>

        {/* Driver photo */}
        <div className="relative flex justify-center pt-2">
          <DriverPhoto code={driver.code} size={photoSize} />
        </div>

        <div className="relative z-10 p-5 pt-2">
          <div className="mb-1 flex items-center gap-2">
            <span
              className="rounded-sm border px-1.5 py-0.5 text-xs font-black tabular-nums"
              style={{ color: metal, borderColor: `${metal}66`, background: `${metal}14` }}
            >
              P{rank}
            </span>
          </div>

          <div className={`font-black italic leading-none ${codeSize}`} style={{ color }}>
            {driver.code}
          </div>

          <div className="mt-1 text-sm font-bold uppercase tracking-wide text-white">
            {driver.given_name}{" "}
            <span className="text-zinc-300">{driver.family_name}</span>
          </div>

          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-500">
            <TeamLogo id={driver.team_id} size={18} />
            {driver.team}
            <NationalityBadge nationality={driver.nationality} className="ml-1" />
          </div>

          <div className="mt-3 flex items-baseline gap-1.5 border-t border-edge pt-3">
            <span className="text-3xl font-black tabular-nums">{driver.points}</span>
            <span className="text-xs uppercase tracking-wider text-zinc-500">pts</span>
            {driver.wins > 0 && (
              <span className="ml-auto flex items-center gap-1 text-amber-400">
                <Trophy size={12} />
                <span className="text-xs font-bold">{driver.wins}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DriverRow({ driver, maxPoints }: { driver: DriverStanding; maxPoints: number }) {
  const color = teamColor(driver.team_id);
  const pct = maxPoints > 0 ? (driver.points / maxPoints) * 100 : 0;

  return (
    <div className="driver-row flex items-center gap-3 rounded-lg border border-edge/50 bg-panel/60 px-4 py-3 transition-colors hover:border-edge hover:bg-panel">
      <span className="w-6 shrink-0 text-center text-sm font-black tabular-nums text-zinc-500">
        {driver.position}
      </span>

      {/* Photo small */}
      <div className="shrink-0 overflow-hidden" style={{ width: 40, height: 40 }}>
        <DriverPhoto code={driver.code} size={40} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-black italic" style={{ color }}>{driver.code}</span>
          <span className="truncate text-sm text-zinc-400">
            {driver.given_name} {driver.family_name}
          </span>
          <NationalityBadge nationality={driver.nationality} />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-600">
          <TeamLogo id={driver.team_id} size={14} />
          {driver.team}
        </div>
      </div>

      <div className="hidden w-32 sm:block">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 text-right">
        {driver.wins > 0 && (
          <span className="flex items-center gap-0.5 text-xs text-amber-400">
            <Trophy size={10} />{driver.wins}
          </span>
        )}
        <span className="w-14 text-right text-sm font-black tabular-nums">{driver.points}</span>
        <span className="text-xs text-zinc-600">pts</span>
      </div>
    </div>
  );
}

export function DriversChampionship() {
  const { year } = useSessionStore();
  const { data: standings, isLoading, error } = useDriverStandings();
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!standings?.length) return;
      gsap.from(".podium-card", {
        opacity: 0, y: 70, scale: 0.88,
        duration: 0.75,
        stagger: { each: 0.13, from: "center" },
        ease: "back.out(1.5)",
        clearProps: "opacity,transform",
      });
      gsap.from(".driver-row", {
        opacity: 0, x: -24,
        duration: 0.4,
        stagger: 0.03,
        ease: "power2.out",
        delay: 0.55,
        clearProps: "opacity,transform",
      });
    },
    { dependencies: [standings], scope: ref },
  );

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <ChartSkeleton key={i} height={360} />)}
        </div>
        <ChartSkeleton height={400} />
      </div>
    );
  }

  if (error || !standings?.length) {
    return (
      <div className="panel py-16 text-center text-zinc-500">
        No hay datos de campeonato disponibles para {year}
      </div>
    );
  }

  // Podium order: P2 left · P1 center · P3 right (a principio de temporada puede haber <3)
  const podium = [
    { driver: standings[1], rank: 2 as const },
    { driver: standings[0], rank: 1 as const },
    { driver: standings[2], rank: 3 as const },
  ].filter((p) => p.driver != null);
  const rest = standings.slice(3);
  const maxPts = standings[0].points;

  return (
    <div ref={ref} className="space-y-6">
      <div className="flex items-baseline gap-3">
        <h2 className="font-wide text-2xl uppercase tracking-wider">
          Mundial de <span className="text-f1red">Pilotos</span>
        </h2>
        <span className="text-sm text-zinc-600">{year}</span>
      </div>

      <div className="grid grid-cols-3 items-end gap-4">
        {podium.map(({ driver, rank }) => (
          <PodiumCard key={driver.driver_id} driver={driver} rank={rank} />
        ))}
      </div>

      <div className="space-y-2">
        {rest.map((d) => (
          <DriverRow key={d.driver_id} driver={d} maxPoints={maxPts} />
        ))}
      </div>
    </div>
  );
}
