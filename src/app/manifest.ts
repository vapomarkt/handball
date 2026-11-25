import type { MetadataRoute } from "next";
import { BRANDING } from "@/config/branding";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRANDING.appName} – ${BRANDING.tagline}`,
    short_name: BRANDING.appName,
    description: BRANDING.description,
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#111820",
    theme_color: "#111820",
    lang: "de",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
