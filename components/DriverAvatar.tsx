"use client";

import { useState } from "react";

/** Foto oficial del piloto con anillo del color de su equipo; cae a un punto de color si no hay foto. */
export function DriverAvatar({
  url,
  color,
  size = 24,
  alt = "",
}: {
  url: string | null | undefined;
  color: string;
  size?: number;
  alt?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    const parts = alt.trim().split(/\s+/).filter(Boolean);
    const initials = (parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0]?.slice(0, 2) ?? "").toUpperCase();
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full font-bold leading-none text-white"
        style={{
          width: size,
          height: size,
          background: color,
          fontSize: size * 0.4,
          border: "1px solid rgba(255,255,255,0.18)",
        }}
        title={alt}
      >
        {initials}
      </span>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="shrink-0 object-contain object-bottom"
      style={{ width: size, height: size, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }}
    />
  );
}
