import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Prosper Hotel",
    short_name: "Prosper Hotel",
    description: "Stock, sales and cash across both locations.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1b002b",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
