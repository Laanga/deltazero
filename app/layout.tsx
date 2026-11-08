import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Titillium_Web } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

import { Providers } from "@/components/Providers";
import { SITE_URL, SITE_NAME, SITE_TITLE, SITE_DESCRIPTION } from "@/lib/site";

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

// Fallback para glifos que F1 Display no cubre. Sin preload: el navegador solo
// lo descarga si de verdad hace falta (unicode-range), no en cada visita.
const titillium = Titillium_Web({
  variable: "--font-titillium",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "Álvaro Langa" }],
  creator: "Álvaro Langa",
  publisher: "Álvaro Langa",
  category: "sports",
  keywords: [
    "F1",
    "Fórmula 1",
    "Formula 1",
    "telemetría",
    "análisis F1",
    "estrategia",
    "vueltas",
    "neumáticos",
    "mundial de pilotos",
    "mundial de constructores",
    "OpenF1",
    "DeltaZero",
  ],
  alternates: {
    canonical: SITE_URL,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "es_ES",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Pantalla completa en iPhone: la barra de pestañas respeta las safe areas
  viewportFit: "cover",
  themeColor: "#0a0a0f",
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
        <Analytics />
      </body>
    </html>
  );
}
