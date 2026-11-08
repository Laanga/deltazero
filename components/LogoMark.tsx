import Image from "next/image";

import { withBasePath } from "@/lib/site";

/** Marca de DeltaZero: la S de Senna en blanco, sin fondo ni recuadro. */
export function LogoMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <Image
      src={withBasePath("/senna-s.png")}
      alt="DeltaZero"
      width={size}
      height={size}
      priority
      className={`object-contain ${className}`}
      style={{ width: size, height: "auto" }}
    />
  );
}
