import vue from "@vitejs/plugin-vue";
import path from "node:path";
import { defineConfig } from "vite";

const root = __dirname;

export default defineConfig({
  root,
  cacheDir: path.resolve(root, "../../node_modules/.vite/apps-desktop"),
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(root, "./src"),
    },
  },
  clearScreen: false,
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
});
