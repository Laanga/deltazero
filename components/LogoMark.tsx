import Image from "next/image";

/** Marca de DeltaZero: la S de Senna en blanco, sin fondo ni recuadro. */
export function LogoMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <Image
      src="/senna-s.png"
      alt="DeltaZero"
      width={size}
      height={size}
      priority
      className={`object-contain ${className}`}
      style={{ width: size, height: "auto" }}
    />
  );
}
