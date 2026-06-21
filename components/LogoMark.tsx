/**
 * Marca de DeltaZero: la S de Senna en blanco, sin fondo ni recuadro.
 */
export function LogoMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src="/senna-s.png"
      alt="DeltaZero"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: "auto", objectFit: "contain" }}
    />
  );
}
