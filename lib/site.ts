// Fuente única de la URL del sitio, usada por metadata, robots y sitemap.
// Sobrescribible con NEXT_PUBLIC_SITE_URL; por defecto, el dominio de producción.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://delta-zero.vercel.app"
).replace(/\/$/, "");

export const SITE_NAME = "DeltaZero";
export const SITE_TITLE = "DeltaZero — Análisis de Fórmula 1";
export const SITE_DESCRIPTION =
  "Panel de análisis de Fórmula 1 con datos reales: telemetría comparativa de hasta 5 pilotos, mapa interactivo del circuito, ritmo y degradación, estrategia de neumáticos y mundiales.";
