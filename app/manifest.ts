import type { MetadataRoute } from "next";

import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: SITE_TITLE,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    lang: "es",
    categories: ["sports", "utilities"],
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#15151e",
    theme_color: "#e10600",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
