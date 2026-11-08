"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Foto del piloto en círculo sobre el color de su equipo (estilo app oficial);
 * cae a iniciales si no hay foto o falla la carga.
 */
export function DriverAvatar({
  url,
  color,
  size = 24,
  alt = "",
  ring = false,
}: {
  url: string | null | undefined;
  color: string;
  size?: number;
  alt?: string;
  /** Anillo exterior del color del equipo (selección activa). */
  ring?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const style: React.CSSProperties = {
    width: size,
    height: size,
    background: `radial-gradient(circle at 50% 30%, ${color}66, ${color}22 70%), rgb(255 255 255 / 0.04)`,
    boxShadow: ring ? `0 0 0 2px ${color}` : "inset 0 0 0 1px rgb(255 255 255 / 0.1)",
  };

  if (!url || failed) {
    const parts = alt.trim().split(/\s+/).filter(Boolean);
    const initials = (
      parts.length >= 2 ? parts[0][0] + parts[1][0] : (parts[0]?.slice(0, 2) ?? "")
    ).toUpperCase();
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full font-bold leading-none text-white"
        style={{ ...style, fontSize: size * 0.38 }}
        title={alt}
      >
        {initials}
      </span>
    );
  }

  return (
    <span className="relative inline-block shrink-0 overflow-hidden rounded-full" style={style}>
      <Image
        src={url}
        alt={alt}
        width={size * 2}
        height={size * 2}
        // Las fotos locales se optimizan; las remotas (OpenF1) ya vienen pequeñas
        unoptimized={url.startsWith("http")}
        onError={() => setFailed(true)}
        className="h-full w-full scale-[1.15] object-cover object-top pt-[8%]"
      />
    </span>
  );
}
