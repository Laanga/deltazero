"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Trophy, Users } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { ChartSkeleton } from "@/components/ChartPanel";
import { NationalityBadge } from "@/components/NationalityBadge";
import { useConstructorStandings, useDriverStandings } from "@/hooks/useF1Data";
import { CAR_IMAGES, DRIVER_PHOTOS, TEAM_LOGOS } from "@/lib/champAssets";
import type { ConstructorStanding } from "@/lib/types";
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

function TeamLogo({ id, size = 56 }: { id: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const src = TEAM_LOGOS[id];
  if (!src || failed) {
    // Fallback: colored circle with first letter
    return (
      <div
        className="flex items-center justify-center rounded-full font-black text-white"
        style={{ width: size, height: size, background: teamColor(id), fontSize: size * 0.4 }}
      >
        {id.charAt(0).toUpperCase()}
      </div>
    );
  }
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

function CarImage({ id, height }: { id: string; height: number }) {
  const year = useSessionStore((s) => s.year);
  const [failed, setFailed] = useState(false);
  const src = CAR_IMAGES[id];
  // Solo hay renders oficiales de los coches 2026: en temporadas pasadas sería un anacronismo
  if (year !== 2026 || !src || failed) return null;
  return (
    <img
      src={src}
      alt=""
      onError={() => setFailed(true)}
      className="pointer-events-none min-w-0 select-none object-contain"
      style={{ height, filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.6))" }}
    />
  );
}

function DriverChip({ code }: { code: string }) {
  const [failed, setFailed] = useState(false);
  const src = DRIVER_PHOTOS[code];

  return (
    <div className="flex items-center gap-1.5">
      {src && !failed ? (
        <img
          src={src}
          alt={code}
          onError={() => setFailed(true)}
          className="object-contain object-bottom"
          style={{ width: 32, height: 32, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }}
        />
      ) : (
        <div className="h-4 w-4 rounded-full bg-zinc-700" />
      )}
      <span className="text-xs font-black text-zinc-300">{code}</span>
    </div>
  );
}

function PodiumCard({
  constructor,
  rank,
  drivers,
}: {
  constructor: ConstructorStanding;
  rank: 1 | 2 | 3;
  drivers: string[];
}) {
  const color = teamColor(constructor.constructor_id);
  const topPad   = rank === 1 ? "pt-0"  : rank === 2 ? "pt-10" : "pt-16";
  const nameSize = rank === 1 ? "text-3xl" : "text-2xl";
  const logoSize = rank === 1 ? 80 : 64;
  const metal    = rank === 1 ? "#e8c352" : rank === 2 ? "#c0c4cc" : "#c8845a";

  return (
    <div className={`constructor-card flex flex-col ${topPad}`}>
      <div
        className="panel relative flex flex-1 flex-col overflow-hidden"
        style={{ borderColor: `${color}55`, boxShadow: `0 0 40px ${color}18` }}
      >
        <div className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />

        <span
          className="pointer-events-none absolute -right-2 -top-4 select-none font-black italic leading-none text-white/[0.04]"
          style={{ fontSize: "10rem" }}
        >
          {rank}
        </span>

        <div className="relative flex flex-col gap-4 p-6">
          {/* Logo + coche + posición */}
          <div className="flex items-center justify-between gap-2">
            <TeamLogo id={constructor.constructor_id} size={logoSize} />
            <CarImage id={constructor.constructor_id} height={logoSize * 0.75} />
            <span
              className="shrink-0 self-start rounded-sm border px-2 py-1 text-sm font-black tabular-nums"
              style={{ color: metal, borderColor: `${metal}66`, background: `${metal}14` }}
            >
              P{rank}
            </span>
          </div>

          {/* Name */}
          <div>
            <div className={`font-black italic uppercase leading-tight ${nameSize}`}>
              {constructor.name}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
              <NationalityBadge nationality={constructor.nationality} />
              {constructor.nationality}
            </div>
          </div>

          {/* Driver chips */}
          {drivers.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {drivers.map((code) => <DriverChip key={code} code={code} />)}
            </div>
          )}

          {/* Points */}
          <div className="flex items-baseline gap-1.5 border-t border-edge pt-3">
            <span className="text-4xl font-black tabular-nums" style={{ color }}>
              {constructor.points}
            </span>
            <span className="text-xs uppercase tracking-wider text-zinc-500">pts</span>
            {constructor.wins > 0 && (
              <span className="ml-auto flex items-center gap-1 text-amber-400">
                <Trophy size={14} />
                <span className="text-sm font-bold">{constructor.wins}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConstructorRow({
  constructor,
  maxPoints,
  drivers,
}: {
  constructor: ConstructorStanding;
  maxPoints: number;
  drivers: string[];
}) {
  const color = teamColor(constructor.constructor_id);
  const pct = maxPoints > 0 ? (constructor.points / maxPoints) * 100 : 0;

  return (
    <div className="constructor-row flex items-center gap-4 rounded-lg border border-edge/50 bg-panel/60 px-4 py-3 transition-colors hover:border-edge hover:bg-panel">
      <span className="w-6 shrink-0 text-center text-sm font-black tabular-nums text-zinc-500">
        {constructor.position}
      </span>

      <div className="shrink-0">
        <TeamLogo id={constructor.constructor_id} size={36} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-black italic uppercase" style={{ color }}>
            {constructor.name}
          </span>
          <NationalityBadge nationality={constructor.nationality} />
        </div>
        {drivers.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-zinc-600">
            <Users size={11} />
            {drivers.join(" · ")}
          </div>
        )}
      </div>

      <div className="hidden shrink justify-end md:flex" style={{ minWidth: 0 }}>
        <CarImage id={constructor.constructor_id} height={28} />
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
        {constructor.wins > 0 && (
          <span className="flex items-center gap-0.5 text-xs text-amber-400">
            <Trophy size={10} />{constructor.wins}
          </span>
        )}
        <span className="w-14 text-right text-sm font-black tabular-nums">{constructor.points}</span>
        <span className="text-xs text-zinc-600">pts</span>
      </div>
    </div>
  );
}

export function ConstructorsChampionship() {
  const { year } = useSessionStore();
  const { data: constructors, isLoading, error } = useConstructorStandings();
  const { data: driverStandings } = useDriverStandings();
  const ref = useRef<HTMLDivElement>(null);

  const driversByTeam = useMemo(() => {
    const byTeam: Record<string, string[]> = {};
    for (const d of driverStandings ?? []) {
      (byTeam[d.team_id] ??= []).push(d.code);
    }
    return byTeam;
  }, [driverStandings]);

  useGSAP(
    () => {
      if (!constructors?.length) return;
      gsap.from(".constructor-card", {
        opacity: 0, y: 70, scale: 0.88,
        duration: 0.75,
        stagger: { each: 0.13, from: "center" },
        ease: "back.out(1.5)",
        clearProps: "opacity,transform",
      });
      gsap.from(".constructor-row", {
        opacity: 0, x: -24,
        duration: 0.4,
        stagger: 0.04,
        ease: "power2.out",
        delay: 0.55,
        clearProps: "opacity,transform",
      });
    },
    { dependencies: [constructors], scope: ref },
  );

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <ChartSkeleton key={i} height={340} />)}
        </div>
        <ChartSkeleton height={360} />
      </div>
    );
  }

  if (error || !constructors?.length) {
    return (
      <div className="panel py-16 text-center text-zinc-500">
        No hay datos de campeonato disponibles para {year}
      </div>
    );
  }

  // P2 izquierda · P1 centro · P3 derecha (a principio de temporada puede haber <3)
  const podium = [
    { team: constructors[1], rank: 2 as const },
    { team: constructors[0], rank: 1 as const },
    { team: constructors[2], rank: 3 as const },
  ].filter((p) => p.team != null);
  const rest = constructors.slice(3);
  const maxPts = constructors[0].points;

  return (
    <div ref={ref} className="space-y-6">
      <div className="flex items-baseline gap-3">
        <h2 className="font-wide text-2xl uppercase tracking-wider">
          Mundial de <span className="text-f1red">Constructores</span>
        </h2>
        <span className="text-sm text-zinc-600">{year}</span>
      </div>

      <div className="grid grid-cols-3 items-end gap-4">
        {podium.map(({ team, rank }) => (
          <PodiumCard
            key={team.constructor_id}
            constructor={team}
            rank={rank}
            drivers={driversByTeam[team.constructor_id] ?? []}
          />
        ))}
      </div>

      <div className="space-y-2">
        {rest.map((c) => (
          <ConstructorRow
            key={c.constructor_id}
            constructor={c}
            maxPoints={maxPts}
            drivers={driversByTeam[c.constructor_id] ?? []}
          />
        ))}
      </div>
    </div>
  );
}
