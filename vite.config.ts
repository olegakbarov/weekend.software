import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST || "127.0.0.1";
const devPort = 1430;

export default defineConfig({
  plugins: [TanStackRouterVite({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  clearScreen: false,
  server: {
    port: devPort,
    strictPort: true,
    host,
    hmr: {
      protocol: "ws",
      host,
      port: devPort + 1,
    },
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
