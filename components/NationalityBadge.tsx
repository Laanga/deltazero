import { NATIONALITY_CODE } from "@/lib/champAssets";

/** Código de país de 3 letras (estilo F1) en una pastilla sobria; nada si no se reconoce. */
export function NationalityBadge({
  nationality,
  className = "",
}: {
  nationality: string;
  className?: string;
}) {
  const code = NATIONALITY_CODE[nationality];
  if (!code) return null;
  return (
    <span
      title={nationality}
      className={`inline-block shrink-0 rounded-sm border border-edge bg-white/5 px-1 py-px font-mono text-[9px] font-bold tracking-wider text-zinc-400 ${className}`}
    >
      {code}
    </span>
  );
}
