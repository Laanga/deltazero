import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DeltaZero — Análisis F1",
    short_name: "DeltaZero",
    description: "Telemetría, comparativas y estrategia de Fórmula 1 con datos reales",
    start_url: "/",
    display: "standalone",
    background_color: "#15151e",
    theme_color: "#e10600",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
