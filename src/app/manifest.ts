import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/**
 * Web manifest, served at /manifest.webmanifest.
 *
 * Generated from the same constants as the metadata rather than written as a
 * static JSON file, so the name, colours and description can never disagree
 * with what the <head> claims.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: SITE.name,
    description: SITE.description,
    start_url: "/",
    display: "standalone",
    background_color: SITE.themeColor,
    theme_color: SITE.themeColor,
    icons: [
      { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
      // `maskable` lets Android crop to whatever shape the launcher uses
      // without clipping the art, which is what the tile's margin is for.
      { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
