"use client";

import Image from "next/image";
import { useState } from "react";

import { CAR_IMAGES, DRIVER_PHOTOS, TEAM_LOGOS, teamColor } from "@/lib/champAssets";
import { useSessionStore } from "@/store/sessionStore";

export const METAL: Record<1 | 2 | 3, string> = { 1: "#e8c352", 2: "#c0c4cc", 3: "#c8845a" };

/** Foto recortada del piloto (asset local optimizado por next/image). */
export function DriverPhoto({
  code,
  size,
  className = "",
}: {
  code: string;
  size: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = DRIVER_PHOTOS[code];
  if (!src || failed) return null;
  return (
    <Image
      src={src}
      alt={code}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={`pointer-events-none select-none object-contain object-bottom drop-shadow-[0_6px_18px_rgb(0_0_0/0.7)] ${className}`}
    />
  );
}

export function TeamLogo({ id, size = 28 }: { id: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const src = TEAM_LOGOS[id];
  if (!src || failed) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full font-black text-white"
        style={{ width: size, height: size, background: teamColor(id), fontSize: size * 0.4 }}
      >
        {id.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <Image
      src={src}
      alt={id}
      width={size * 2}
      height={size * 2}
      onError={() => setFailed(true)}
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}

/** Render oficial del coche (solo existe el de 2026: en otras temporadas sería un anacronismo). */
export function CarImage({ id, height }: { id: string; height: number }) {
  const year = useSessionStore((s) => s.year);
  const [failed, setFailed] = useState(false);
  const src = CAR_IMAGES[id];
  if (year !== 2026 || !src || failed) return null;
  return (
    <Image
      src={src}
      alt=""
      width={Math.round(height * 4.5)}
      height={height}
      onError={() => setFailed(true)}
      className="pointer-events-none min-w-0 select-none object-contain drop-shadow-[0_6px_12px_rgb(0_0_0/0.6)]"
      style={{ height, width: "auto" }}
    />
  );
}

/** Tarjeta de podio: halo del color del equipo, franja superior y marca de agua de la posición. */
export function PodiumShell({
  rank,
  color,
  index,
  children,
}: {
  rank: 1 | 2 | 3;
  color: string;
  index: number;
  children: React.ReactNode;
}) {
  // En móvil P1 primero; en escritorio P2 · P1 · P3 con P1 más alto
  const order = rank === 1 ? "order-first sm:order-none" : "";
  const topPad = rank === 1 ? "sm:pt-0" : rank === 2 ? "sm:pt-10" : "sm:pt-16";
  return (
    <div
      className={`stagger flex flex-col ${order} ${topPad}`}
      style={{ "--i": index } as React.CSSProperties}
    >
      <div
        className="panel relative flex flex-1 flex-col overflow-hidden"
        style={{
          background: `radial-gradient(120% 70% at 50% 0%, ${color}2e, transparent 70%), var(--glass-fill), var(--color-panel)`,
          borderColor: `${color}40`,
        }}
      >
        <span
          className="pointer-events-none absolute -right-2 -top-6 select-none font-black italic leading-none text-white/[0.04]"
          style={{ fontSize: "10rem" }}
        >
          {rank}
        </span>
        {children}
      </div>
    </div>
  );
}

export function RankBadge({ rank }: { rank: 1 | 2 | 3 }) {
  const metal = METAL[rank];
  return (
    <span
      className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-black tabular-nums"
      style={{ color: metal, background: `${metal}1f`, boxShadow: `inset 0 0 0 1px ${metal}55` }}
    >
      P{rank}
    </span>
  );
}

/** Barra de puntos relativa al líder. */
export function PointsBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="hidden w-32 sm:block">
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

export function StandingsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-80" />
        ))}
      </div>
      <div className="skeleton h-96" />
    </div>
  );
}
