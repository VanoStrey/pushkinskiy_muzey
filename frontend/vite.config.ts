import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

// Dev server only: /api is proxied to the backend, like API Gateway does in
// the cloud. The production build is plain static files in dist/.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    allowedHosts: true,
    proxy: {
      "/api/": process.env.API_PROXY_TARGET || "http://localhost:8000",
    },
    // Docker on macOS/Windows does not deliver file events from mounted folders.
    watch: { usePolling: process.env.VITE_USE_POLLING === "true" },
  },
  build: { outDir: "dist" },
});
