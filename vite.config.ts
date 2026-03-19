import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST || "127.0.0.1";
const devPort = 1430;

function manualChunkForDependency(id: string): string | undefined {
  if (!id.includes("node_modules")) return undefined;
  if (id.includes("@replit/codemirror-vim")) {
    return "vendor-editor-vim";
  }
  if (id.includes("@codemirror/lang-")) {
    return "vendor-editor-lang";
  }
  if (
    id.includes("@codemirror") ||
    id.includes("/codemirror/") ||
    id.includes("/@lezer/") ||
    id.includes("/@marijn/")
  ) {
    return "vendor-editor";
  }
  if (id.includes("@xterm")) return "vendor-terminal";
  if (
    id.includes("@dnd-kit") ||
    id.includes("@radix-ui") ||
    id.includes("lucide-react")
  ) {
    return "vendor-ui";
  }
  return undefined;
}

export default defineConfig({
  plugins: [TanStackRouterVite({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: manualChunkForDependency,
      },
    },
  },
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
