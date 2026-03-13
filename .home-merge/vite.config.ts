import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  server: {
    port: 8548,
    host: "127.0.0.1",
  },
  plugins: [tsConfigPaths(), tailwindcss(), tanstackStart(), viteReact()],
});
