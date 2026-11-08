import type { Metadata } from "next";

import { LabShowcase } from "./LabShowcase";

export const metadata: Metadata = {
  title: "Lab",
  robots: { index: false, follow: false },
};

/** Página interna del sistema de diseño: primitivas en todos sus estados. */
export default function LabPage() {
  return <LabShowcase />;
}
