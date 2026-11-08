import type { MetadataRoute } from "next";

import { BASE_PATH, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, withBasePath } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: `${BASE_PATH}/`,
    name: SITE_TITLE,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    lang: "es",
    categories: ["sports", "utilities"],
    start_url: `${BASE_PATH}/`,
    scope: `${BASE_PATH}/`,
    display: "standalone",
    orientation: "any",
    background_color: "#0a0a0f",
    theme_color: "#0a0a0f",
    icons: [
      { src: withBasePath("/icon.png"), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: withBasePath("/icon.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
