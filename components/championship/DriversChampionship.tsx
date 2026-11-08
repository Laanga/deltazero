"use client";

import { Trophy } from "lucide-react";

import {
  DriverPhoto,
  PodiumShell,
  PointsBar,
  RankBadge,
  StandingsSkeleton,
  TeamLogo,
} from "@/components/championship/shared";
import { NationalityBadge } from "@/components/NationalityBadge";
import { useDriverStandings } from "@/hooks/useF1Data";
import { teamColor } from "@/lib/champAssets";
import type { DriverStanding } from "@/lib/types";
import { useSessionStore } from "@/store/sessionStore";

function PodiumCard({
  driver,
  rank,
  index,
}: {
  driver: DriverStanding;
  rank: 1 | 2 | 3;
  index: number;
}) {
  const color = teamColor(driver.team_id);
  return (
    <PodiumShell rank={rank} color={color} index={index}>
      <div className="relative flex justify-center pt-3">
        <DriverPhoto
          code={driver.code}
          size={rank === 1 ? 220 : 170}
          className={rank === 1 ? "h-44 w-44 md:h-55 md:w-55" : "h-36 w-36 md:h-42 md:w-42"}
        />
      </div>

      <div className="relative z-10 p-5 pt-2">
        <RankBadge rank={rank} />
        <div
          className={`mt-2 font-black italic leading-none ${rank === 1 ? "text-7xl md:text-8xl" : "text-6xl"}`}
          style={{ color }}
        >
          {driver.code}
        </div>
        <div className="mt-1 text-sm font-bold uppercase tracking-wide">
          {driver.given_name} <span className="text-ink-2">{driver.family_name}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-3">
          <TeamLogo id={driver.team_id} size={18} />
          {driver.team}
          <NationalityBadge nationality={driver.nationality} className="ml-1" />
        </div>

        <div className="mt-4 flex items-baseline gap-1.5 rounded-[18px] bg-white/[0.04] px-4 py-3">
          <span className="text-3xl font-black tabular-nums">{driver.points}</span>
          <span className="text-xs uppercase tracking-wider text-ink-3">pts</span>
          {driver.wins > 0 && (
            <span className="ml-auto flex items-center gap-1 text-amber-300">
              <Trophy size={12} />
              <span className="text-xs font-bold">{driver.wins}</span>
            </span>
          )}
        </div>
      </div>
    </PodiumShell>
  );
}

function DriverRow({
  driver,
  maxPoints,
  index,
}: {
  driver: DriverStanding;
  maxPoints: number;
  index: number;
}) {
  const color = teamColor(driver.team_id);
  const pct = maxPoints > 0 ? (driver.points / maxPoints) * 100 : 0;
  return (
    <div
      style={{ "--i": index } as React.CSSProperties}
      className="stagger flex items-center gap-3 border-b border-white/[0.05] px-4 py-2.5 transition-colors last:border-0 hover:bg-white/[0.04]"
    >
      <span className="w-6 shrink-0 text-center text-sm font-black tabular-nums text-ink-3">
        {driver.position}
      </span>
      <span
        className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full"
        style={{ background: `radial-gradient(circle at 50% 30%, ${color}55, ${color}18 70%)` }}
      >
        <DriverPhoto
          code={driver.code}
          size={40}
          className="h-full w-full scale-[1.15] object-cover object-top pt-[6%]"
        />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-black italic" style={{ color }}>
            {driver.code}
          </span>
          <span className="truncate text-sm text-ink-2">
            {driver.given_name} {driver.family_name}
          </span>
          <NationalityBadge nationality={driver.nationality} />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-ink-3">
          <TeamLogo id={driver.team_id} size={14} />
          {driver.team}
        </div>
      </div>

      <PointsBar pct={pct} color={color} />

      <div className="flex shrink-0 items-center gap-3 text-right">
        {driver.wins > 0 && (
          <span className="flex items-center gap-0.5 text-xs text-amber-300">
            <Trophy size={10} />
            {driver.wins}
          </span>
        )}
        <span className="w-12 text-right text-sm font-black tabular-nums">{driver.points}</span>
        <span className="hidden text-xs text-ink-3 sm:inline">pts</span>
      </div>
    </div>
  );
}

export function DriversChampionship() {
  const year = useSessionStore((s) => s.year);
  const { data: standings, isLoading, error } = useDriverStandings();

  if (isLoading) return <StandingsSkeleton />;
  if (error || !standings?.length) {
    return (
      <div className="panel py-16 text-center text-ink-3">
        No hay datos de campeonato disponibles para {year}
      </div>
    );
  }

  // P2 izquierda · P1 centro · P3 derecha (a principio de temporada puede haber <3)
  const podium = [
    { driver: standings[1], rank: 2 as const },
    { driver: standings[0], rank: 1 as const },
    { driver: standings[2], rank: 3 as const },
  ].filter((p) => p.driver != null);
  const maxPts = standings[0].points;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline gap-3 px-1">
        <h2 className="font-wide text-xl uppercase tracking-wider md:text-2xl">
          Mundial de <span className="text-f1red">Pilotos</span>
        </h2>
        <span className="text-sm text-ink-3">{year}</span>
      </div>

      <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-3">
        {podium.map(({ driver, rank }, i) => (
          <PodiumCard key={driver.driver_id} driver={driver} rank={rank} index={i} />
        ))}
      </div>

      <div className="panel overflow-hidden p-1.5">
        {standings.slice(3).map((d, i) => (
          <DriverRow key={d.driver_id} driver={d} maxPoints={maxPts} index={i + 3} />
        ))}
      </div>
    </div>
  );
}
