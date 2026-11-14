import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/env";

/**
 * The web app manifest (installable app). The background colour is the
 * calm page colour; the accent stays in the icon only. The theme colour per
 * light / dark mode is set in the root layout's viewport (a manifest can't).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: `${siteUrl()}/home`,
    name: "Remember Me",
    short_name: "Remember Me",
    description: "Remember the people you love, and your own day too.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: "#f4f5f9",
    theme_color: "#f4f5f9",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
