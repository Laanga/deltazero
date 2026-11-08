// Ruta bajo la que vive la app (basePath de Next). El portfolio, en
// www.laanga.xyz, reenvía /proyectos/deltazero a este despliegue.
export const BASE_PATH = "/proyectos/deltazero";

// Fuente única de la URL del sitio, usada por metadata y la imagen de vista previa. Robots y sitemap los da el portfolio.
// Sobrescribible con NEXT_PUBLIC_SITE_URL; por defecto, la dirección pública.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? `https://www.laanga.xyz${BASE_PATH}`
).replace(/\/$/, "");

/** Ruta de un archivo de /public con el basePath delante (next/image no lo añade a las rutas en texto). */
export const withBasePath = (path: string) => `${BASE_PATH}${path}`;

export const SITE_NAME = "DeltaZero";
export const SITE_TITLE = "DeltaZero — Análisis de Fórmula 1";
export const SITE_DESCRIPTION =
  "Panel de análisis de Fórmula 1 con datos reales: telemetría comparativa de hasta 5 pilotos, mapa interactivo del circuito, ritmo y degradación, estrategia de neumáticos y mundiales.";
