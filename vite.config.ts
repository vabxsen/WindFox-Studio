import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://v2.tauri.app/start/frontend/vite/
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: {
    // WebView2 is Chromium-based and kept current by Windows.
    target: "chrome120",
    sourcemap: false,
    // One local bundle is fine for a desktop app; Fluent UI makes it ~630 kB.
    chunkSizeWarningLimit: 900,
  },
});
