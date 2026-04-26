import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Radio Station Simulator",
    short_name: "WPRD Radio",
    description: "Personal radio station simulator — Spotify playlist + local station IDs",
    start_url: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#1a120c",
    theme_color: "#3d2918",
    categories: ["entertainment", "music"],
    icons: [
      {
        src: "/icon",
        type: "image/png",
        sizes: "512x512",
        purpose: "any",
      },
      {
        src: "/icon",
        type: "image/png",
        sizes: "192x192",
        purpose: "any",
      },
      {
        src: "/icon",
        type: "image/png",
        sizes: "512x512",
        purpose: "maskable",
      },
    ],
  };
}
