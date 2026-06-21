import { DriverAvatar } from "@/components/DriverAvatar";

/** Identidad de piloto en tablas: avatar + código + nombre completo. */
export function DriverTag({
  code,
  fullName,
  color,
  headshot,
  size = 28,
  hideNameOnMobile = false,
}: {
  code: string;
  fullName: string;
  color: string;
  headshot: string | null | undefined;
  size?: number;
  hideNameOnMobile?: boolean;
}) {
  return (
    <span className="flex items-center gap-2.5 font-bold">
      <DriverAvatar url={headshot} color={color} size={size} alt={fullName} />
      {code}
      <span className={`font-normal text-zinc-500 ${hideNameOnMobile ? "hidden sm:inline" : ""}`}>
        {fullName}
      </span>
    </span>
  );
}
