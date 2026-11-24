import type { MetadataRoute } from "next";
import { BRANDING } from "@/config/branding";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRANDING.appName} – ${BRANDING.tagline}`,
    short_name: BRANDING.appName,
    description: BRANDING.description,
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0b1220",
    theme_color: "#0f766e",
    lang: "de",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
