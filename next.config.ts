import type { NextConfig } from "next";

import { BASE_PATH, SITE_URL } from "./lib/site";

const nextConfig: NextConfig = {
  // La app se sirve en www.laanga.xyz/proyectos/deltazero: el portfolio
  // (Laanga/Portfolio) reenvía esa ruta a este despliegue.
  basePath: BASE_PATH,
  async redirects() {
    // La dirección antigua (delta-zero.vercel.app/) lleva a la nueva.
    return [{ source: "/", destination: SITE_URL, basePath: false, permanent: true }];
  },
  // No filtrar la versión del framework en las cabeceras
  poweredByHeader: false,
  compress: true,
  // Fija la raíz del workspace (hay varios lockfiles en el sistema) y silencia el aviso
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
