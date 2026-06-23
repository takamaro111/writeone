import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  optimizeDeps: {
    entries: ["index.html"]
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["offline.html", "icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "WriteOne",
        short_name: "WriteOne",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#0B2A66",
        background_color: "#FFFFFF",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
        ]
      },
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/pdf\//],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,json}"]
      }
    })
  ]
});
