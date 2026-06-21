import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No filtrar la versión del framework en las cabeceras
  poweredByHeader: false,
  compress: true,
  // Fija la raíz del workspace (hay varios lockfiles en el sistema) y silencia el aviso
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
