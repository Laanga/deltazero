import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Titillium_Web } from "next/font/google";
import "./globals.css";

import { Providers } from "@/components/Providers";

// Tipografía oficial F1 Display (uso personal, no comercial)
const f1Display = localFont({
  src: [
    { path: "./fonts/F1-Display-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/F1-Display-Italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/F1-Display-Bold.woff2", weight: "700", style: "normal" },
    { path: "./fonts/F1-Display-Black.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-f1",
});

const f1Wide = localFont({
  src: "./fonts/F1-Display-Wide.woff2",
  variable: "--font-f1-wide",
});

// Fallback con buen soporte de acentos y pesos intermedios
const titillium = Titillium_Web({
  variable: "--font-titillium",
  subsets: ["latin"],
  weight: ["300", "400", "600", "700", "900"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://deltazero.vercel.app";
const TITLE = "DeltaZero — Análisis F1";
const DESCRIPTION =
  "Telemetría, comparativas y estrategia de Fórmula 1 con datos reales: velocidad, sectores, vueltas, campeonatos y más.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "DeltaZero",
  keywords: ["F1", "Fórmula 1", "telemetría", "análisis", "estrategia", "OpenF1", "DeltaZero"],
  icons: { icon: "/icon.png", apple: "/icon.png" },
  openGraph: {
    type: "website",
    siteName: "DeltaZero",
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "es_ES",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#e10600",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${f1Display.variable} ${f1Wide.variable} ${titillium.variable} h-full antialiased`}
    >
      {/* suppressHydrationWarning: las extensiones del navegador inyectan atributos en <body> */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
