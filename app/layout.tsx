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

// Fallback con buen soporte de acentos y pesos intermedios
const titillium = Titillium_Web({
  variable: "--font-titillium",
  subsets: ["latin"],
  weight: ["300", "400", "600", "700", "900"],
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
    canonical: "/",
  },
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
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
        <Analytics />
      </body>
    </html>
  );
}
