"use client";

import { Trophy, Users } from "lucide-react";
import { useMemo } from "react";

import {
  CarImage,
  DriverPhoto,
  PodiumShell,
  PointsBar,
  RankBadge,
  StandingsSkeleton,
  TeamLogo,
  useTeamColor,
} from "@/components/championship/shared";
import { NationalityBadge } from "@/components/NationalityBadge";
import { useConstructorStandings, useDriverStandings } from "@/hooks/useF1Data";
import type { ConstructorStanding } from "@/lib/types";
import { useSessionStore } from "@/store/sessionStore";

function DriverChip({ code, color }: { code: string; color: string }) {
  return (
    <span className="fill-control flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2.5">
      <span
        className="relative h-7 w-7 overflow-hidden rounded-full"
        style={{ background: `radial-gradient(circle at 50% 30%, ${color}55, ${color}18 70%)` }}
      >
        <DriverPhoto
          code={code}
          size={28}
          className="h-full w-full scale-[1.15] object-cover object-top pt-[6%]"
        />
      </span>
      <span className="text-xs font-black">{code}</span>
    </span>
  );
}

function PodiumCard({
  constructor,
  rank,
  drivers,
  index,
}: {
  constructor: ConstructorStanding;
  rank: 1 | 2 | 3;
  drivers: string[];
  index: number;
}) {
  const teamColorOf = useTeamColor();
  const color = teamColorOf(constructor.constructor_id);
  const logoSize = rank === 1 ? 72 : 60;
  return (
    <PodiumShell rank={rank} color={color} index={index}>
      <div className="relative flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between gap-2">
          <TeamLogo id={constructor.constructor_id} size={logoSize} />
          <CarImage id={constructor.constructor_id} height={logoSize * 0.7} />
          <span className="self-start">
            <RankBadge rank={rank} />
          </span>
        </div>

        <div>
          <div
            className={`font-black uppercase leading-tight ${rank === 1 ? "text-3xl" : "text-2xl"}`}
          >
            {constructor.name}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-3">
            <NationalityBadge nationality={constructor.nationality} />
            {constructor.nationality}
          </div>
        </div>

        {drivers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {drivers.map((code) => (
              <DriverChip key={code} code={code} color={color} />
            ))}
          </div>
        )}

        <div className="flex items-baseline gap-1.5 rounded-[18px] bg-white/[0.04] px-4 py-3">
          <span className="text-4xl font-black tabular-nums" style={{ color }}>
            {constructor.points}
          </span>
          <span className="text-xs uppercase tracking-wider text-ink-3">pts</span>
          {constructor.wins > 0 && (
            <span className="ml-auto flex items-center gap-1 text-amber-300">
              <Trophy size={14} />
              <span className="text-sm font-bold">{constructor.wins}</span>
            </span>
          )}
        </div>
      </div>
    </PodiumShell>
  );
}

function ConstructorRow({
  constructor,
  maxPoints,
  drivers,
  index,
}: {
  constructor: ConstructorStanding;
  maxPoints: number;
  drivers: string[];
  index: number;
}) {
  const teamColorOf = useTeamColor();
  const color = teamColorOf(constructor.constructor_id);
  const pct = maxPoints > 0 ? (constructor.points / maxPoints) * 100 : 0;
  return (
    <div
      style={{ "--i": index } as React.CSSProperties}
      className="stagger flex items-center gap-4 border-b border-white/[0.05] px-4 py-3 transition-colors last:border-0 hover:bg-white/[0.04]"
    >
      <span className="w-6 shrink-0 text-center text-sm font-black tabular-nums text-ink-3">
        {constructor.position}
      </span>
      <TeamLogo id={constructor.constructor_id} size={34} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-black uppercase" style={{ color }}>
            {constructor.name}
          </span>
          <NationalityBadge nationality={constructor.nationality} />
        </div>
        {drivers.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-ink-3">
            <Users size={11} />
            {drivers.join(" · ")}
          </div>
        )}
      </div>

      <div className="hidden min-w-0 shrink justify-end md:flex">
        <CarImage id={constructor.constructor_id} height={26} />
      </div>
      <PointsBar pct={pct} color={color} />

      <div className="flex shrink-0 items-center gap-3 text-right">
        {constructor.wins > 0 && (
          <span className="flex items-center gap-0.5 text-xs text-amber-300">
            <Trophy size={10} />
            {constructor.wins}
          </span>
        )}
        <span className="w-12 text-right text-sm font-black tabular-nums">
          {constructor.points}
        </span>
        <span className="hidden text-xs text-ink-3 sm:inline">pts</span>
      </div>
    </div>
  );
}

export function ConstructorsChampionship() {
  const year = useSessionStore((s) => s.year);
  const { data: constructors, isLoading, error } = useConstructorStandings();
  const { data: driverStandings } = useDriverStandings();

  const driversByTeam = useMemo(() => {
    const byTeam: Record<string, string[]> = {};
    for (const d of driverStandings ?? []) (byTeam[d.team_id] ??= []).push(d.code);
    return byTeam;
  }, [driverStandings]);

  if (isLoading) return <StandingsSkeleton />;
  if (error || !constructors?.length) {
    return (
      <div className="panel py-16 text-center text-ink-3">
        No hay datos de campeonato disponibles para {year}
      </div>
    );
  }

  const podium = [
    { team: constructors[1], rank: 2 as const },
    { team: constructors[0], rank: 1 as const },
    { team: constructors[2], rank: 3 as const },
  ].filter((p) => p.team != null);
  const maxPts = constructors[0].points;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline gap-3 px-1">
        <h2 className="font-wide text-xl uppercase tracking-wider md:text-2xl">
          Mundial de <span className="text-f1red">Constructores</span>
        </h2>
        <span className="text-sm text-ink-3">{year}</span>
      </div>

      <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-3">
        {podium.map(({ team, rank }, i) => (
          <PodiumCard
            key={team.constructor_id}
            constructor={team}
            rank={rank}
            index={i}
            drivers={driversByTeam[team.constructor_id] ?? []}
          />
        ))}
      </div>

      <div className="panel overflow-hidden p-1.5">
        {constructors.slice(3).map((c, i) => (
          <ConstructorRow
            key={c.constructor_id}
            constructor={c}
            maxPoints={maxPts}
            index={i + 3}
            drivers={driversByTeam[c.constructor_id] ?? []}
          />
        ))}
      </div>
    </div>
  );
}
